import requests
import re
from typing import Any
from config import settings


def parse_pr_url(pr_url: str):
    match = re.search(r"github\.com/([^/]+)/([^/]+)/pull/(\d+)", pr_url)
    if not match:
        raise ValueError(f"Invalid GitHub PR URL: {pr_url}")
    return match.groups()


def github_get(url: str, headers: dict):
    response = requests.get(url, headers=headers, timeout=30)

    if response.status_code != 200:
        raise Exception(f"GitHub API error: {response.status_code} - {response.text}")

    return response.json()


def github_get_text(url: str, headers: dict):
    response = requests.get(url, headers=headers, timeout=30)

    if response.status_code != 200:
        raise Exception(f"GitHub API error: {response.status_code} - {response.text}")

    return response.text


def fetch_paginated(url: str, headers: dict):
    results = []
    page = 1

    while True:
        paginated_url = f"{url}?per_page=100&page={page}"
        data = github_get(paginated_url, headers)

        if not data:
            break

        results.extend(data)
        page += 1

    return results


def fetch_pr_public(pr_url: str):
    headers = {
        "Accept": "application/vnd.github+json"
    }

    if settings.GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"

    owner, repo, pr_number = parse_pr_url(pr_url)

    base_api = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"

    pr_data = github_get(base_api, headers)

    files = fetch_paginated(f"{base_api}/files", headers)

    comments = fetch_paginated(f"{base_api}/comments", headers)

    review_comments = fetch_paginated(
        f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/comments",
        headers
    )

    reviews = fetch_paginated(f"{base_api}/reviews", headers)

    compare_url = (
        f"https://api.github.com/repos/{owner}/{repo}/compare/"
        f"{pr_data['base']['sha']}...{pr_data['head']['sha']}"
    )

    raw_diff = github_get_text(compare_url, {**headers, "Accept": "application/vnd.github.v3.diff"})

    def build_change(file_payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "filename": file_payload["filename"],
            "status": file_payload["status"],
            "additions": file_payload["additions"],
            "deletions": file_payload["deletions"],
            "patch": file_payload.get("patch"),
        }

    return {
        "repo_owner": owner,
        "repo_name": repo,
        "pr_number": int(pr_number),
        "repo": f"{owner}/{repo}",
        "title": pr_data.get("title"),
        "author": pr_data.get("user", {}).get("login"),
        "state": pr_data.get("state"),
        "base_branch": pr_data.get("base", {}).get("ref"),
        "head_branch": pr_data.get("head", {}).get("ref"),

        "files": [build_change(f) for f in files],

        "comments": [
            {
                "user": c["user"]["login"],
                "comment": c["body"]
            }
            for c in comments
        ],

        "review_comments": [
            {
                "user": rc["user"]["login"],
                "comment": rc["body"],
                "file": rc.get("path"),
                "line": rc.get("line")
            }
            for rc in review_comments
        ],

        "reviews": [
            {
                "user": r["user"]["login"],
                "state": r["state"],
                "body": r["body"]
            }
            for r in reviews
        ],
        "raw_diff": raw_diff,
    }
