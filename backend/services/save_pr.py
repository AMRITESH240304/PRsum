from db.mongo import pr_collection
from datetime import datetime, timezone
from uuid import uuid4


def save_pr_to_mongo(data: dict):
    stored = {
        **data,
        "summary_id": data.get("summary_id") or str(uuid4()),
        "created_at": datetime.now(timezone.utc),
    }

    # upsert (avoid duplicates)
    pr_collection.update_one(
        {"summary_id": stored["summary_id"]},
        {"$set": stored},
        upsert=True
    )

    return stored