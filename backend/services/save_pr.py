from db.mongo import pr_collection
from datetime import datetime


def save_pr_to_mongo(data: dict):
    data["created_at"] = datetime.utcnow()

    # upsert (avoid duplicates)
    pr_collection.update_one(
        {
            "pr_number": data["pr_number"],
            "repo": data["repo"]
        },
        {"$set": data},
        upsert=True
    )