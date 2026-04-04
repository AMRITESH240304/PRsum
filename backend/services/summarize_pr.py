from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass
from typing import Any, Literal

from config import settings
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

ChangeType = Literal["feat", "fix", "refactor", "chore"]


@dataclass
class SummaryArtifact:
    summary: str
    changes: list[dict[str, Any]]
    filesAffected: list[dict[str, Any]]
    changelog: str
    checklist: list[dict[str, Any]]


def _build_models() -> tuple[ChatOpenAI, ChatOpenAI]:
    common_kwargs = {
        "base_url": settings.OXLO_BASE_URL,
        "api_key": settings.OXLOAPI_KEY,
        "temperature": 0.2,
    }
    analysis_model = ChatOpenAI(model="qwen-3-coder-30b", **common_kwargs)
    summary_model = ChatOpenAI(model="gemma-3-27b", **common_kwargs)
    return analysis_model, summary_model


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
    if file_payload:
        dominant_change = Counter(item["changeType"] for item in file_payload).most_common(1)[0][0]
    else:
        dominant_change = "chore"

    summary = (
        f"This PR updates {pr_data.get('repo', 'the repository')} by changing "
        f"{len(file_payload)} file(s). The diff appears to be focused on {dominant_change} work."
    )
    changes = [
        {
            "type": item["changeType"],
            "description": f"Update {item['filename']} ({item['additions']} additions, {item['deletions']} deletions)",
        }
        for item in file_payload[:6]
    ]
    changelog = (
        f"## {pr_data.get('repo', 'Repository')} #{pr_data.get('pr_number', '')}\n\n"
        f"### Summary\n- {summary}"
    )
    checklist = [
        {"id": "1", "label": "Diff reviewed for correctness", "checked": False},
        {"id": "2", "label": "Tests updated for touched paths", "checked": False},
        {"id": "3", "label": "No obvious regressions introduced", "checked": False},
    ]
    return SummaryArtifact(
        summary=summary,
        changes=changes,
        filesAffected=file_payload,
        changelog=changelog,
        checklist=checklist,
    )


def generate_pr_summary(pr_data: dict[str, Any]) -> dict[str, Any]:
    analysis_model, summary_model = _build_models()
    payload = _build_analysis_payload(pr_data)

    analysis_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are a senior code reviewer. Read the pull request diff, comments, and reviews. "
                "Return concise analysis notes focused on intent, risks, notable files, and likely user-facing impact.",
            ),
            (
                "human",
                "Repository metadata:\n{metadata}\n\nRaw diff excerpt:\n{raw_diff_excerpt}",
            ),
        ]
    )
    analysis_chain = analysis_prompt | analysis_model | StrOutputParser()

    summary_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are a PR summarizer. Produce JSON only. Use plain English. "
                "Return an object with keys: summary, changes, filesAffected, changelog, checklist. "
                "changes must be an array of {type, description}. filesAffected must be an array of {filename, changeType, additions, deletions}. "
                "checklist must be an array of {id, label, checked}. Keep the summary concise and the changelog in Markdown.",
            ),
            (
                "human",
                "Analysis notes:\n{analysis}\n\nInput payload:\n{payload}",
            ),
        ]
    )
    summary_chain = summary_prompt | summary_model | StrOutputParser()

    try:
        analysis_text = analysis_chain.invoke(
            {
                "metadata": json.dumps({k: v for k, v in payload.items() if k != "raw_diff_excerpt"}, indent=2),
                "raw_diff_excerpt": payload["raw_diff_excerpt"],
            }
        )
        summary_text = summary_chain.invoke(
            {
                "analysis": analysis_text,
                "payload": json.dumps(payload, indent=2),
            }
        )
        parsed = _parse_json_output(summary_text)
        return {
            "summary": parsed["summary"],
            "changes": parsed["changes"],
            "filesAffected": parsed["filesAffected"],
            "changelog": parsed["changelog"],
            "checklist": parsed["checklist"],
        }
    except Exception:
        fallback = _fallback_summary(pr_data)
        return {
            "summary": fallback.summary,
            "changes": fallback.changes,
            "filesAffected": fallback.filesAffected,
            "changelog": fallback.changelog,
            "checklist": fallback.checklist,
        }
