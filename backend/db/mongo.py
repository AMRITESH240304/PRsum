from pymongo import MongoClient
from config import settings

client = MongoClient(settings.MONGODB_URI)
db = client["pr_db"]

users_collection = db["users"]
history_collection = db["pull_request_summaries"]

# Backwards-compatible alias for the existing code path.
pr_collection = history_collection