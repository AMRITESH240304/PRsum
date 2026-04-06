from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sse_starlette.sse import EventSourceResponse

from db.mongo import history_collection
from rate_limiter import limiter
from schemas import GoogleAuthRequest, PRSummaryRequest, SummaryArtifact
from services.auth import authenticate_google_user, get_user_from_token
from services.fetch_pr import fetch_pr_public
from services.save_pr import save_pr_to_mongo
from services.summarize_pr import generate_pr_summary_with_trace

router = APIRouter()


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None

    prefix = "Bearer "
    if authorization.startswith(prefix):
        return authorization[len(prefix):].strip()

    return authorization.strip()


def _history_document_to_response(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": document.get("summary_id") or str(document.get("_id")),
        "userId": document.get("user_id"),
        "repoName": document.get("repoName") or document.get("repo"),
        "prNumber": document.get("prNumber") or document.get("pr_number"),
        "prTitle": document.get("prTitle") or document.get("title"),
        "author": document.get("author"),
        "date": document.get("date") or document.get("created_at", datetime.now(timezone.utc)).isoformat(),
        "summary": document.get("summary", ""),
        "changes": document.get("changes", []),
        "filesAffected": document.get("filesAffected", []),
        "changelog": document.get("changelog", ""),
        "checklist": document.get("checklist", []),
        "rawDiff": document.get("rawDiff", ""),
        "risk": document.get("risk"),
        "insights": document.get("insights", []),
        "pr": document.get("pr"),
    }


async def _prepare_pr_data(payload: PRSummaryRequest, user: dict[str, Any]) -> dict[str, Any]:
    if payload.pr_url:
        return await run_in_threadpool(fetch_pr_public, payload.pr_url)

    if not payload.diff_text:
        raise HTTPException(status_code=400, detail="Provide either pr_url or diff_text")

    return {
        "repo": payload.repo or "manual/diff",
        "pr_number": payload.pr_number or 0,
        "title": payload.title or "Uploaded diff",
        "author": payload.author or user["name"],
        "state": "open",
        "files": [],
        "comments": [],
        "review_comments": [],
        "reviews": [],
        "raw_diff": payload.diff_text,
    }


def _build_history_record(
    summary: dict[str, Any],
    pr_data: dict[str, Any],
    user: dict[str, Any],
) -> dict[str, Any]:
    return {
        "user_id": user["id"],
        "repoName": pr_data.get("repo", "manual/diff"),
        "prNumber": int(pr_data.get("pr_number") or 0),
        "prTitle": pr_data.get("title", "Uploaded diff"),
        "author": pr_data.get("author"),
        "date": datetime.now(timezone.utc).isoformat(),
        "summary": summary["summary"],
        "changes": summary["changes"],
        "filesAffected": summary["filesAffected"],
        "changelog": summary["changelog"],
        "checklist": summary["checklist"],
        "rawDiff": pr_data.get("raw_diff", ""),
        "risk": summary.get("risk"),
        "insights": summary.get("insights", []),
        "pr": {
            "title": pr_data.get("title", "Uploaded diff"),
            "author": pr_data.get("author") or user["name"],
            "number": int(pr_data.get("pr_number") or 0),
            "repo": pr_data.get("repo", "manual/diff"),
            "branch_from": pr_data.get("head_branch") or "unknown",
            "branch_to": pr_data.get("base_branch") or "main",
            "status": pr_data.get("state") or "open",
            "opened": "recently",
            "files_changed": len(summary.get("filesAffected", [])),
            "additions": sum(item.get("additions", 0) for item in summary.get("filesAffected", [])),
            "deletions": sum(item.get("deletions", 0) for item in summary.get("filesAffected", [])),
        },
        "repo": pr_data.get("repo", "manual/diff"),
        "pr_number": pr_data.get("pr_number", 0),
        "title": pr_data.get("title", "Uploaded diff"),
        "prUrl": pr_data.get("html_url"),
    }


@router.get("/hello")
def say_hello():
    return {"message": "Hello from another route!"}


@router.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/auth/google")
def google_auth(payload: GoogleAuthRequest):
    try:
        user = authenticate_google_user(payload.credential)
        return {"user": user}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/history")
def get_history(authorization: str | None = Header(default=None)):
    token = _extract_bearer_token(authorization)
    user = get_user_from_token(token)
    documents = (
        history_collection.find({"user_id": user["id"]}).sort("created_at", -1)
    )
    return {"items": [_history_document_to_response(document) for document in documents]}


@router.delete("/history/{summary_id}")
def delete_history(summary_id: str, authorization: str | None = Header(default=None)):
    token = _extract_bearer_token(authorization)
    user = get_user_from_token(token)
    result = history_collection.delete_one({"summary_id": summary_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Summary not found")

    return {"message": "Deleted"}


@router.post("/api/history")
def save_to_history(
    summary: SummaryArtifact,
    authorization: str | None = Header(default=None),
):
    token = _extract_bearer_token(authorization)
    user_id = "anonymous"
    if token:
        user = get_user_from_token(token)
        user_id = user["id"]

    record = {
        "summary_id": summary.id,
        "user_id": user_id,
        "repoName": summary.repoName,
        "prNumber": summary.prNumber,
        "prTitle": summary.prTitle,
        "author": summary.author,
        "date": summary.date or datetime.now(timezone.utc).isoformat(),
        "summary": summary.summary,
        "changes": summary.changes,
        "filesAffected": summary.filesAffected,
        "changelog": summary.changelog,
        "checklist": summary.checklist,
        "rawDiff": summary.rawDiff,
        "risk": summary.risk,
        "insights": summary.insights,
        "pr": summary.pr,
        "prUrl": summary.prUrl,
        "repo": summary.repoName,
        "pr_number": summary.prNumber,
        "title": summary.prTitle,
    }

    saved = save_pr_to_mongo(record)
    created_at = saved.get("created_at")
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()

    return {
        "id": saved.get("summary_id"),
        "created_at": created_at,
    }


@router.get("/api/history")
def get_history_paginated(
    limit: int = 20,
    skip: int = 0,
    authorization: str | None = Header(default=None),
):
    safe_limit = max(1, min(limit, 100))
    safe_skip = max(0, skip)

    token = _extract_bearer_token(authorization)
    query: dict[str, Any] = {}
    if token:
        user = get_user_from_token(token)
        query["user_id"] = user["id"]

    cursor = history_collection.find(query).sort("created_at", -1).skip(safe_skip).limit(safe_limit)
    items: list[dict[str, Any]] = []

    for document in cursor:
        created_at = document.get("created_at")
        if hasattr(created_at, "isoformat"):
            created_at = created_at.isoformat()

        summary_text = document.get("summary", "")
        risk = document.get("risk") or {}

        items.append(
            {
                "id": document.get("summary_id") or str(document.get("_id")),
                "repo": document.get("repoName") or document.get("repo"),
                "pr_number": document.get("prNumber") or document.get("pr_number"),
                "title": document.get("prTitle") or document.get("title"),
                "risk_level": risk.get("level", "unknown"),
                "created_at": created_at,
                "summary_preview": summary_text[:240],
            }
        )

    total = history_collection.count_documents(query)
    return {
        "items": items,
        "limit": safe_limit,
        "skip": safe_skip,
        "total": total,
    }


@router.post("/summarize-pr/stream")
async def summarize_pr_stream(
    payload: PRSummaryRequest,
    authorization: str | None = Header(default=None),
):
    token = _extract_bearer_token(authorization)
    user = get_user_from_token(token or payload.credential)

    async def event_generator():
        try:
            yield {"event": "stage", "data": json.dumps({"message": "Authenticating user", "status": "running"})}

            if payload.pr_url:
                yield {"event": "stage", "data": json.dumps({"message": "Fetching PR metadata and git diff", "status": "running"})}
            else:
                yield {"event": "stage", "data": json.dumps({"message": "Using pasted diff input", "status": "running"})}

            pr_data = await _prepare_pr_data(payload, user)

            for file_payload in pr_data.get("files", []):
                yield {
                    "event": "file",
                    "data": json.dumps(
                        {
                            "filename": file_payload["filename"],
                            "status": file_payload.get("status", "modified"),
                            "additions": file_payload.get("additions", 0),
                            "deletions": file_payload.get("deletions", 0),
                            "patch": file_payload.get("patch"),
                        }
                    ),
                }

            yield {"event": "stage", "data": json.dumps({"message": "Running LangGraph multi-agent pipeline", "status": "running"})}

            loop = asyncio.get_running_loop()
            agent_event_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

            def on_agent_event(event: dict[str, Any]):
                loop.call_soon_threadsafe(agent_event_queue.put_nowait, event)

            summary_task = asyncio.create_task(
                asyncio.to_thread(generate_pr_summary_with_trace, pr_data, on_agent_event)
            )

            while not summary_task.done() or not agent_event_queue.empty():
                try:
                    event = await asyncio.wait_for(agent_event_queue.get(), timeout=0.2)
                    yield {"event": "agent", "data": json.dumps(event)}
                except asyncio.TimeoutError:
                    pass

            summary = await summary_task

            record = _build_history_record(summary, pr_data, user)

            yield {"event": "stage", "data": json.dumps({"message": "Saving summary to history", "status": "running"})}
            saved = await run_in_threadpool(save_pr_to_mongo, record)
            record["id"] = saved["summary_id"]
            record["userId"] = user["id"]

            yield {"event": "summary", "data": json.dumps(_history_document_to_response(saved))}
            yield {"event": "stage", "data": json.dumps({"message": "Completed", "status": "done"})}
            yield {"event": "done", "data": json.dumps({"ok": True, "summaryId": saved["summary_id"]})}
        except HTTPException as exc:
            yield {"event": "error", "data": json.dumps({"message": exc.detail, "status": "error"})}
        except Exception as exc:
            yield {"event": "error", "data": json.dumps({"message": str(exc), "status": "error"})}


    return EventSourceResponse(event_generator())


@router.post("/api/summarize/stream")
async def summarize_stream_api(
    payload: PRSummaryRequest,
    authorization: str | None = Header(default=None),
):
    return await summarize_pr_stream(payload, authorization)


@router.post("/api/summarize")
@limiter.limit("10/minute")
async def summarize_pr(
    request: Request,
    payload: PRSummaryRequest,
    authorization: str | None = Header(default=None),
):
    _ = request
    token = _extract_bearer_token(authorization)
    user = get_user_from_token(token or payload.credential)

    pr_data = await _prepare_pr_data(payload, user)
    summary = await run_in_threadpool(generate_pr_summary_with_trace, pr_data, None)

    record = _build_history_record(summary, pr_data, user)
    saved = await run_in_threadpool(save_pr_to_mongo, record)
    return _history_document_to_response(saved)