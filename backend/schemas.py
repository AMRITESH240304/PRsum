from typing import Any, Literal

from pydantic import BaseModel, Field


ChangeType = Literal["feat", "fix", "refactor", "chore"]


class GoogleAuthRequest(BaseModel):
    credential: str = Field(min_length=10)


class PRSummaryRequest(BaseModel):
    credential: str | None = None
    pr_url: str | None = None
    diff_text: str | None = None
    repo: str | None = None
    pr_number: int | None = None
    title: str | None = None
    author: str | None = None


class PRChange(BaseModel):
    type: ChangeType
    description: str


class PRFileChange(BaseModel):
    filename: str
    changeType: ChangeType
    additions: int
    deletions: int


class ChecklistItem(BaseModel):
    id: str
    label: str
    checked: bool = False


class UserProfile(BaseModel):
    id: str
    google_sub: str
    email: str
    name: str
    picture: str | None = None


class PRSummaryPayload(BaseModel):
    repoName: str
    prNumber: int
    prTitle: str
    author: str | None = None
    summary: str
    changes: list[PRChange]
    filesAffected: list[PRFileChange]
    changelog: str
    checklist: list[ChecklistItem]
    rawDiff: str


class PRSummaryRecord(PRSummaryPayload):
    id: str
    userId: str
    date: str


class SummaryArtifact(BaseModel):
    id: str | None = None
    repoName: str
    prNumber: int
    prTitle: str
    author: str | None = None
    date: str | None = None
    summary: str
    changes: list[dict[str, Any]] = []
    filesAffected: list[dict[str, Any]] = []
    changelog: str = ""
    checklist: list[dict[str, Any]] = []
    rawDiff: str = ""
    risk: dict[str, Any] | None = None
    insights: list[dict[str, Any]] = []
    pr: dict[str, Any] | None = None
    prUrl: str | None = None
