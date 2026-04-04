from __future__ import annotations

from datetime import datetime, timezone

import requests
from fastapi import HTTPException

from config import settings
from db.mongo import users_collection

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


def _verify_google_credential(credential: str) -> dict:
    response = requests.get(
        GOOGLE_TOKENINFO_URL,
        params={"id_token": credential},
        timeout=20,
    )

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    token_info = response.json()
    if token_info.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Google token audience mismatch")

    if token_info.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=401, detail="Invalid Google token issuer")

    return token_info


def authenticate_google_user(credential: str) -> dict:
    token_info = _verify_google_credential(credential)
    google_sub = token_info["sub"]
    email = token_info.get("email", "")
    name = token_info.get("name") or token_info.get("email", "Unknown User")
    picture = token_info.get("picture")

    user_document = {
        "google_sub": google_sub,
        "email": email,
        "name": name,
        "picture": picture,
        "updated_at": datetime.now(timezone.utc),
    }

    users_collection.update_one(
        {"google_sub": google_sub},
        {
            "$set": user_document,
            "$setOnInsert": {"created_at": datetime.now(timezone.utc)},
        },
        upsert=True,
    )

    existing = users_collection.find_one({"google_sub": google_sub}) or {}

    return {
        "id": str(existing.get("_id")),
        "google_sub": google_sub,
        "email": email,
        "name": name,
        "picture": picture,
    }


def get_user_from_token(credential: str | None) -> dict:
    if not credential:
        raise HTTPException(status_code=401, detail="Missing Google credential")

    return authenticate_google_user(credential)
