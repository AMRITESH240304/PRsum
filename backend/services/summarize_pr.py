from __future__ import annotations

import json
import operator
import re
from collections import Counter
from dataclasses import asdict, dataclass
from typing import Annotated, Any, Literal, TypedDict

from config import settings
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

ChangeType = Literal["feat", "fix", "refactor", "chore"]


@dataclass
class SummaryArtifact:
    summary: str
    changes: list[dict[str, Any]]
    filesAffected: list[dict[str, Any]]
    changelog: str
    checklist: list[dict[str, Any]]


@dataclass
class ParsedFile:
    filename: str
    change_type: ChangeType
    additions: int
    deletions: int
    patch: str
    file_summary: str = ""


@dataclass
class DiffChunk:
    filename: str
    hunk_header: str
    context: str
    added_lines: list[str]
    removed_lines: list[str]


class PRSummaryState(TypedDict):
    pr_data: dict[str, Any]
    raw_diff: str

    parsed_files: list[ParsedFile]
    diff_chunks: list[DiffChunk]

    risk_level: str
    risk_reason: str
    pr_intent: str
    file_summaries: Annotated[list[dict[str, Any]], operator.add]

    summary: str
    changes: list[dict[str, Any]]
    files_affected: list[dict[str, Any]]
    changelog: str
    checklist: list[dict[str, Any]]
    insights: list[dict[str, Any]]

    errors: Annotated[list[str], operator.add]
    retry_count: int


def _build_models() -> dict[str, ChatOpenAI]:
    common_kwargs = {
        "base_url": settings.OXLO_BASE_URL,
        "api_key": settings.OXLOAPI_KEY,
        "temperature": 0.2,
    }
    return {
        "risk": ChatOpenAI(model="qwen-3-coder-30b", **common_kwargs),
        "intent": ChatOpenAI(model="gemma-3-27b", **common_kwargs),
        "file": ChatOpenAI(model="qwen-3-coder-30b", **common_kwargs),
        "summary": ChatOpenAI(model="gemma-3-27b", **common_kwargs),
        "changelog": ChatOpenAI(model="qwen-3-coder-30b", **common_kwargs),
        "checklist": ChatOpenAI(model="gemma-3-27b", **common_kwargs),
    }


_MODELS = _build_models()


def _infer_change_type(filename: str, status: str, additions: int, deletions: int) -> ChangeType:
    lower_name = filename.lower()
    if status == "added" or additions > deletions:
        if any(token in lower_name for token in ["test", "spec", "fixture"]):
            return "chore"
        return "feat"
    if status == "removed":
        return "fix"
    if any(token in lower_name for token in ["test", "docs", "readme", "config"]):
        return "chore"
    if deletions > additions:
        return "refactor"
    return "fix"


def _build_file_payload(files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "filename": file_payload["filename"],
            "changeType": _infer_change_type(
                file_payload["filename"],
                file_payload.get("status", "modified"),
                int(file_payload.get("additions", 0)),
                int(file_payload.get("deletions", 0)),
            ),
            "additions": int(file_payload.get("additions", 0)),
            "deletions": int(file_payload.get("deletions", 0)),
            "status": file_payload.get("status", "modified"),
            "patch": file_payload.get("patch"),
        }
        for file_payload in files
    ]


def _build_raw_diff(files: list[dict[str, Any]]) -> str:
    diff_sections: list[str] = []
    for file_payload in files:
        filename = file_payload["filename"]
        patch = file_payload.get("patch")
        diff_sections.append(f"diff --git a/{filename} b/{filename}")
        if patch:
            diff_sections.append(patch)
        else:
            diff_sections.append(
                f"--- a/{filename}\n+++ b/{filename}\n@@ -1,0 +1,0 @@\n"
                f"# Patch unavailable for this file"
            )
    return "\n".join(diff_sections)


def _build_analysis_payload(pr_data: dict[str, Any]) -> dict[str, Any]:
    files = pr_data.get("files", [])
    raw_diff = pr_data.get("raw_diff") or _build_raw_diff(files)
    return {
        "repo": pr_data.get("repo"),
        "pr_number": pr_data.get("pr_number"),
        "title": pr_data.get("title"),
        "author": pr_data.get("author"),
        "state": pr_data.get("state"),
        "base_branch": pr_data.get("base_branch"),
        "head_branch": pr_data.get("head_branch"),
        "comments": pr_data.get("comments", []),
        "review_comments": pr_data.get("review_comments", []),
        "reviews": pr_data.get("reviews", []),
        "files": _build_file_payload(files),
        "raw_diff_excerpt": raw_diff[:24000],
    }


def _parse_json_output(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def _fallback_summary(pr_data: dict[str, Any]) -> SummaryArtifact:
    files = pr_data.get("files", [])
    file_payload = _build_file_payload(files)

    key_files = [item["filename"].split("/")[-1] for item in file_payload[:3]]
    key_fragment = ", ".join(key_files) if key_files else "the updated modules"

    summary = (
        f"This PR introduces targeted improvements in {pr_data.get('repo', 'the repository')} "
        f"with the most impactful changes centered around {key_fragment}. "
        "The implementation adds new behavior and wiring while preserving existing flow patterns. "
        "It also includes supporting updates to keep the integration path stable for current consumers."
    )
    changes = [
        {
            "type": item["changeType"],
            "description": f"Update {item['filename']} ({item['additions']} additions, {item['deletions']} deletions)",
        }
        for item in file_payload[:8]
    ]
    changelog = (
        f"## {pr_data.get('repo', 'Repository')} #{pr_data.get('pr_number', '')}\n\n"
        f"### Summary\n- {summary}"
    )
    checklist = [
        {"id": "1", "label": "Validate integration paths touched by core files", "checked": False},
        {"id": "2", "label": "Run regression tests on modified execution paths", "checked": False},
        {"id": "3", "label": "Confirm configuration changes are documented", "checked": False},
        {"id": "4", "label": "Check error handling for new branches", "checked": False},
    ]
    return SummaryArtifact(
        summary=summary,
        changes=changes,
        filesAffected=file_payload,
        changelog=changelog,
        checklist=checklist,
    )


def _safe_invoke(prompt: ChatPromptTemplate, model_key: str, values: dict[str, Any]) -> str:
    chain = prompt | _MODELS[model_key] | StrOutputParser()
    return chain.invoke(values)


def _extract_hunks(filename: str, patch: str) -> list[DiffChunk]:
    chunks: list[DiffChunk] = []
    current_header = ""
    current_lines: list[str] = []

    for line in patch.splitlines():
        if line.startswith("@@"):
            if current_header:
                added = [entry[1:] for entry in current_lines if entry.startswith("+") and not entry.startswith("+++")]
                removed = [entry[1:] for entry in current_lines if entry.startswith("-") and not entry.startswith("---")]
                context = "\n".join(entry for entry in current_lines if entry.startswith(" "))
                chunks.append(
                    DiffChunk(
                        filename=filename,
                        hunk_header=current_header,
                        context=context[:1200],
                        added_lines=added[:80],
                        removed_lines=removed[:80],
                    )
                )
            current_header = line
            current_lines = []
        else:
            current_lines.append(line)

    if current_header:
        added = [entry[1:] for entry in current_lines if entry.startswith("+") and not entry.startswith("+++")]
        removed = [entry[1:] for entry in current_lines if entry.startswith("-") and not entry.startswith("---")]
        context = "\n".join(entry for entry in current_lines if entry.startswith(" "))
        chunks.append(
            DiffChunk(
                filename=filename,
                hunk_header=current_header,
                context=context[:1200],
                added_lines=added[:80],
                removed_lines=removed[:80],
            )
        )

    return chunks


def diff_parser_node(state: PRSummaryState) -> PRSummaryState:
    pr_data = state["pr_data"]
    files = _build_file_payload(pr_data.get("files", []))
    parsed_files: list[ParsedFile] = []
    diff_chunks: list[DiffChunk] = []

    for file_payload in files:
        patch = (file_payload.get("patch") or "")[:8000]
        parsed_files.append(
            ParsedFile(
                filename=file_payload["filename"],
                change_type=file_payload["changeType"],
                additions=file_payload["additions"],
                deletions=file_payload["deletions"],
                patch=patch,
            )
        )
        if patch:
            diff_chunks.extend(_extract_hunks(file_payload["filename"], patch))

    return {
        "parsed_files": parsed_files,
        "diff_chunks": diff_chunks,
        "raw_diff": state["raw_diff"],
    }


def risk_analyzer_node(state: PRSummaryState) -> PRSummaryState:
    try:
        parsed_files = state["parsed_files"]
        changed = [item.filename.lower() for item in parsed_files]
        has_tests = any("test" in item for item in changed)
        total_add = sum(item.additions for item in parsed_files)
        total_del = sum(item.deletions for item in parsed_files)

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a risk analyzer for pull requests. Return JSON only with keys: "
                    "risk_level, risk_reason, risk_factors, positive_signals.",
                ),
                (
                    "human",
                    "Files:\n{files}\n\nTotals: additions={additions}, deletions={deletions}, has_tests={has_tests}\n"
                    "Use low/medium/high risk.",
                ),
            ]
        )
        response = _safe_invoke(
            prompt,
            "risk",
            {
                "files": json.dumps([asdict(item) for item in parsed_files], indent=2),
                "additions": total_add,
                "deletions": total_del,
                "has_tests": has_tests,
            },
        )
        parsed = _parse_json_output(response)

        risk_level = str(parsed.get("risk_level", "low")).lower()
        risk_reason = parsed.get("risk_reason", "Limited blast radius detected")

        if any(token in " ".join(changed) for token in ["auth", "security", "migration"]):
            risk_level = "high"
            risk_reason = "Security/authentication or migration paths were touched"
        elif any("config" in item or ".env" in item for item in changed) and not has_tests:
            risk_level = "high"
            risk_reason = "Core config modified without test coverage updates"
        elif total_add - total_del > 500 and not has_tests:
            risk_level = "high"
            risk_reason = "Large net code additions with no tests changed"

        insights: list[dict[str, Any]] = []
        for warning in parsed.get("risk_factors", [])[:4]:
            insights.append({"type": "warning", "text": warning})
        for positive in parsed.get("positive_signals", [])[:4]:
            insights.append({"type": "insight", "text": positive})

        return {
            "risk_level": risk_level,
            "risk_reason": risk_reason,
            "insights": insights,
        }
    except Exception as exc:
        return {
            "risk_level": "medium",
            "risk_reason": "Risk analyzer degraded, manual review recommended",
            "insights": [{"type": "warning", "text": "Risk model failed; use manual risk review"}],
            "errors": [f"risk_analyzer_node: {exc}"],
        }


def intent_node(state: PRSummaryState) -> PRSummaryState:
    try:
        pr_data = state["pr_data"]
        payload = _build_analysis_payload(pr_data)

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "Infer the PR's overall purpose in one concise paragraph. Focus on feature/fix intent and impact.",
                ),
                (
                    "human",
                    "Title: {title}\nAuthor: {author}\nBranch: {head} -> {base}\n"
                    "Files:\n{files}\n\nDiff excerpt:\n{diff}",
                ),
            ]
        )
        intent_text = _safe_invoke(
            prompt,
            "intent",
            {
                "title": payload.get("title"),
                "author": payload.get("author"),
                "head": payload.get("head_branch"),
                "base": payload.get("base_branch"),
                "files": json.dumps(payload.get("files", [])[:30], indent=2),
                "diff": payload.get("raw_diff_excerpt", "")[:3000],
            },
        )
        return {"pr_intent": intent_text.strip()}
    except Exception as exc:
        return {
            "pr_intent": "The PR introduces targeted enhancements and integration updates.",
            "errors": [f"intent_node: {exc}"],
        }


def route_files(state: PRSummaryState):
    sends: list[Send] = []
    for item in state["parsed_files"]:
        sends.append(
            Send(
                "analyze_single_file",
                {
                    "parsed_file": item,
                    "pr_intent": state.get("pr_intent", ""),
                },
            )
        )
    return sends


def analyze_single_file_node(state: dict[str, Any]) -> dict[str, Any]:
    parsed_file: ParsedFile = state["parsed_file"]
    pr_intent = state.get("pr_intent", "")

    try:
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "Analyze one changed file and return JSON with: filename, summary, key_changes.",
                ),
                (
                    "human",
                    "PR intent:\n{intent}\n\nFile:\n{file}\n\nPatch:\n{patch}",
                ),
            ]
        )
        response = _safe_invoke(
            prompt,
            "file",
            {
                "intent": pr_intent,
                "file": json.dumps(asdict(parsed_file), indent=2),
                "patch": parsed_file.patch[:8000],
            },
        )
        parsed = _parse_json_output(response)
        return {
            "file_summaries": [
                {
                    "filename": parsed.get("filename", parsed_file.filename),
                    "summary": parsed.get("summary", "Updated implementation details for this file."),
                    "key_changes": parsed.get("key_changes", []),
                    "change_type": parsed_file.change_type,
                    "additions": parsed_file.additions,
                    "deletions": parsed_file.deletions,
                }
            ]
        }
    except Exception as exc:
        return {
            "file_summaries": [
                {
                    "filename": parsed_file.filename,
                    "summary": "Updated implementation details for this file.",
                    "key_changes": [],
                    "change_type": parsed_file.change_type,
                    "additions": parsed_file.additions,
                    "deletions": parsed_file.deletions,
                }
            ],
            "errors": [f"analyze_single_file_node ({parsed_file.filename}): {exc}"],
        }


def aggregator_node(state: PRSummaryState) -> PRSummaryState:
    file_summaries = state.get("file_summaries", [])
    parsed_files = state.get("parsed_files", [])

    summary_map = {entry.get("filename"): entry for entry in file_summaries}

    changes: list[dict[str, Any]] = []
    files_affected: list[dict[str, Any]] = []

    for item in parsed_files:
        file_summary = summary_map.get(item.filename, {})
        description = file_summary.get("summary") or f"Updated {item.filename} implementation details"
        changes.append({"type": item.change_type, "description": description})
        files_affected.append(
            {
                "filename": item.filename,
                "changeType": item.change_type,
                "additions": item.additions,
                "deletions": item.deletions,
                "status": "modified",
                "patch": item.patch,
                "summary": description,
            }
        )

    deduped_insights: list[dict[str, Any]] = []
    seen = set()
    for item in state.get("insights", []):
        key = (item.get("type"), item.get("text"))
        if key in seen:
            continue
        seen.add(key)
        deduped_insights.append(item)

    return {
        "changes": changes,
        "files_affected": files_affected,
        "insights": deduped_insights,
    }


def summary_writer_node(state: PRSummaryState) -> PRSummaryState:
    try:
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "Write a 3-5 sentence narrative PR summary like a senior engineer. "
                    "Never lead with file count. Mention impactful files by name and explain what this enables.",
                ),
                (
                    "human",
                    "PR metadata:\n{metadata}\n\nRisk: {risk_level} ({risk_reason})\n\n"
                    "Intent:\n{intent}\n\nFile summaries:\n{files}",
                ),
            ]
        )

        metadata = {
            "repo": state["pr_data"].get("repo"),
            "title": state["pr_data"].get("title"),
            "author": state["pr_data"].get("author"),
            "pr_number": state["pr_data"].get("pr_number"),
            "base_branch": state["pr_data"].get("base_branch"),
            "head_branch": state["pr_data"].get("head_branch"),
        }

        text = _safe_invoke(
            prompt,
            "summary",
            {
                "metadata": json.dumps(metadata, indent=2),
                "risk_level": state.get("risk_level", "low"),
                "risk_reason": state.get("risk_reason", ""),
                "intent": state.get("pr_intent", ""),
                "files": json.dumps(state.get("file_summaries", [])[:20], indent=2),
            },
        ).strip()

        return {"summary": text}
    except Exception as exc:
        return {
            "summary": "",
            "errors": [f"summary_writer_node: {exc}"],
        }


def changelog_node(state: PRSummaryState) -> PRSummaryState:
    try:
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "Generate a markdown changelog grouped by Added/Changed/Fixed/Refactored/Tests/Chore. "
                    "Use concrete file references when possible.",
                ),
                (
                    "human",
                    "Repo: {repo}\nPR: {pr}\n\nChanges:\n{changes}\n\nFile summaries:\n{files}",
                ),
            ]
        )
        text = _safe_invoke(
            prompt,
            "changelog",
            {
                "repo": state["pr_data"].get("repo"),
                "pr": state["pr_data"].get("pr_number"),
                "changes": json.dumps(state.get("changes", []), indent=2),
                "files": json.dumps(state.get("file_summaries", []), indent=2),
            },
        )
        return {"changelog": text}
    except Exception as exc:
        return {
            "changelog": "",
            "errors": [f"changelog_node: {exc}"],
        }


def checklist_node(state: PRSummaryState) -> PRSummaryState:
    try:
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "Generate 4-7 specific reviewer checklist items as JSON array of strings. "
                    "Each item must reference concrete files or behaviors.",
                ),
                (
                    "human",
                    "Risk: {risk}\n\nInsights:\n{insights}\n\nFiles:\n{files}\n\nChanges:\n{changes}",
                ),
            ]
        )
        raw = _safe_invoke(
            prompt,
            "checklist",
            {
                "risk": f"{state.get('risk_level', 'low')} - {state.get('risk_reason', '')}",
                "insights": json.dumps(state.get("insights", []), indent=2),
                "files": json.dumps(state.get("file_summaries", []), indent=2),
                "changes": json.dumps(state.get("changes", []), indent=2),
            },
        )

        checklist_items: list[str]
        try:
            checklist_items = json.loads(raw)
            if not isinstance(checklist_items, list):
                checklist_items = []
        except Exception:
            checklist_items = [line.strip("- ").strip() for line in raw.splitlines() if line.strip()][:7]

        checklist = [
            {
                "id": str(index + 1),
                "label": item,
                "checked": False,
            }
            for index, item in enumerate(checklist_items)
            if item
        ]

        return {"checklist": checklist}
    except Exception as exc:
        return {
            "checklist": [],
            "errors": [f"checklist_node: {exc}"],
        }


def output_validator_node(state: PRSummaryState) -> PRSummaryState:
    errors = list(state.get("errors", []))
    retry_count = state.get("retry_count", 0)

    summary_text = (state.get("summary") or "").strip()
    if not summary_text or "by changing" in summary_text.lower():
        retry_count += 1
        errors.append("summary generic or empty")

    checklist = state.get("checklist", [])
    if len(checklist) < 3:
        fallback_items = [
            "Validate changed core modules against regression scenarios",
            "Confirm tests cover newly introduced execution paths",
            "Review configuration/default changes for backward compatibility",
        ]
        for label in fallback_items:
            checklist.append({"id": str(len(checklist) + 1), "label": label, "checked": False})

    changelog = (state.get("changelog") or "").strip()
    if "###" not in changelog:
        changelog = (
            f"## {state['pr_data'].get('repo', 'Repository')} #{state['pr_data'].get('pr_number', '')}\n\n"
            "### Added\n- Notable additions captured from the diff\n\n"
            "### Changed\n- Behavioral and structural updates across touched modules"
        )

    return {
        "retry_count": retry_count,
        "errors": errors,
        "checklist": checklist,
        "changelog": changelog,
    }


def should_retry(state: PRSummaryState) -> str:
    if state.get("retry_count", 0) > 2:
        return "done"
    if any("summary generic or empty" in err for err in state.get("errors", [])):
        return "retry"
    return "done"


def build_pr_summary_graph():
    graph = StateGraph(PRSummaryState)

    graph.add_node("diff_parser", diff_parser_node)
    graph.add_node("risk_analyzer", risk_analyzer_node)
    graph.add_node("intent", intent_node)
    graph.add_node("analyze_single_file", analyze_single_file_node)
    graph.add_node("aggregator", aggregator_node)
    graph.add_node("summary_writer", summary_writer_node)
    graph.add_node("changelog", changelog_node)
    graph.add_node("checklist", checklist_node)
    graph.add_node("output_validator", output_validator_node)

    graph.add_edge(START, "diff_parser")
    graph.add_edge("diff_parser", "risk_analyzer")
    graph.add_edge("diff_parser", "intent")
    graph.add_conditional_edges("diff_parser", route_files, ["analyze_single_file"])

    graph.add_edge("risk_analyzer", "aggregator")
    graph.add_edge("intent", "aggregator")
    graph.add_edge("analyze_single_file", "aggregator")

    graph.add_edge("aggregator", "summary_writer")
    graph.add_edge("summary_writer", "changelog")
    graph.add_edge("changelog", "checklist")
    graph.add_edge("checklist", "output_validator")

    graph.add_conditional_edges(
        "output_validator",
        should_retry,
        {
            "retry": "summary_writer",
            "done": END,
        },
    )

    return graph.compile()


def generate_pr_summary_with_trace(
    pr_data: dict[str, Any],
    on_event: callable | None = None,
) -> dict[str, Any]:
    def emit(step: str, agent: str, status: str, message: str, details: dict[str, Any] | None = None):
        if not on_event:
            return
        on_event(
            {
                "step": step,
                "agent": agent,
                "status": status,
                "message": message,
                "details": details or {},
            }
        )

    state: PRSummaryState = {
        "pr_data": pr_data,
        "raw_diff": pr_data.get("raw_diff") or _build_raw_diff(pr_data.get("files", [])),
        "parsed_files": [],
        "diff_chunks": [],
        "risk_level": "low",
        "risk_reason": "",
        "pr_intent": "",
        "file_summaries": [],
        "summary": "",
        "changes": [],
        "files_affected": [],
        "changelog": "",
        "checklist": [],
        "insights": [],
        "errors": [],
        "retry_count": 0,
    }

    try:
        emit("diff_parser", "diff_parser_node", "running", "Parsing raw diff and building file hunks")
        state.update(diff_parser_node(state))
        emit(
            "diff_parser",
            "diff_parser_node",
            "done",
            "Diff parsing completed",
            {
                "parsed_files": len(state.get("parsed_files", [])),
                "diff_chunks": len(state.get("diff_chunks", [])),
            },
        )

        emit("risk", "risk_analyzer_node", "running", "Evaluating PR risk factors")
        state.update(risk_analyzer_node(state))
        emit(
            "risk",
            "risk_analyzer_node",
            "done",
            "Risk analysis completed",
            {
                "risk_level": state.get("risk_level", "low"),
                "risk_reason": state.get("risk_reason", ""),
            },
        )

        emit("intent", "intent_node", "running", "Deriving overall PR intent")
        state.update(intent_node(state))
        emit("intent", "intent_node", "done", "Intent extraction completed")

        parsed_files = state.get("parsed_files", [])
        for index, parsed_file in enumerate(parsed_files):
            emit(
                "file_analysis",
                "analyze_single_file_node",
                "running",
                f"Analyzing file {index + 1}/{len(parsed_files)}",
                {"filename": parsed_file.filename},
            )
            update = analyze_single_file_node({"parsed_file": parsed_file, "pr_intent": state.get("pr_intent", "")})
            state["file_summaries"].extend(update.get("file_summaries", []))
            state["errors"].extend(update.get("errors", []))
            emit(
                "file_analysis",
                "analyze_single_file_node",
                "done",
                "File analysis completed",
                {"filename": parsed_file.filename},
            )

        emit("aggregate", "aggregator_node", "running", "Aggregating risk, intent, and file outputs")
        state.update(aggregator_node(state))
        emit("aggregate", "aggregator_node", "done", "Aggregation completed")

        emit("summary", "summary_writer_node", "running", "Writing narrative summary")
        state.update(summary_writer_node(state))
        emit("summary", "summary_writer_node", "done", "Narrative summary completed")

        emit("changelog", "changelog_node", "running", "Generating markdown changelog")
        state.update(changelog_node(state))
        emit("changelog", "changelog_node", "done", "Changelog generated")

        emit("checklist", "checklist_node", "running", "Generating review checklist")
        state.update(checklist_node(state))
        emit("checklist", "checklist_node", "done", "Checklist generated")

        while True:
            emit("validate", "output_validator_node", "running", "Validating output schema and content")
            state.update(output_validator_node(state))
            retry_decision = should_retry(state)
            emit(
                "validate",
                "output_validator_node",
                "done",
                "Validation completed",
                {"retry": retry_decision == "retry", "retry_count": state.get("retry_count", 0)},
            )
            if retry_decision != "retry":
                break
            emit("summary", "summary_writer_node", "running", "Retrying summary writer after validation")
            state.update(summary_writer_node(state))
            emit("summary", "summary_writer_node", "done", "Retry summary completed")

        summary_text = (state.get("summary") or "").strip()
        if not summary_text:
            emit("fallback", "_fallback_summary", "running", "Primary summary missing, switching to fallback")
            fallback = _fallback_summary(pr_data)
            emit("fallback", "_fallback_summary", "done", "Fallback summary generated")
            return {
                "summary": fallback.summary,
                "changes": fallback.changes,
                "filesAffected": fallback.filesAffected,
                "changelog": fallback.changelog,
                "checklist": fallback.checklist,
                "insights": state.get("insights", []),
                "risk": {
                    "level": state.get("risk_level", "medium"),
                    "reason": state.get("risk_reason", "Summary generation degraded"),
                },
            }

        emit("complete", "pipeline", "done", "Agent pipeline completed successfully")
        return {
            "summary": summary_text,
            "changes": state.get("changes", []),
            "filesAffected": state.get("files_affected", []),
            "changelog": state.get("changelog", ""),
            "checklist": state.get("checklist", []),
            "insights": state.get("insights", []),
            "risk": {
                "level": state.get("risk_level", "low"),
                "reason": state.get("risk_reason", "Limited blast-radius detected"),
            },
        }
    except Exception as exc:
        emit("error", "pipeline", "error", "Unhandled error in graph pipeline", {"error": str(exc)})
        fallback = _fallback_summary(pr_data)
        return {
            "summary": fallback.summary,
            "changes": fallback.changes,
            "filesAffected": fallback.filesAffected,
            "changelog": fallback.changelog,
            "checklist": fallback.checklist,
            "insights": [{"type": "warning", "text": f"Pipeline failed: {exc}"}],
            "risk": {"level": "medium", "reason": "Pipeline degraded; verify manually"},
        }


def generate_pr_summary(pr_data: dict[str, Any]) -> dict[str, Any]:
    return generate_pr_summary_with_trace(pr_data)
