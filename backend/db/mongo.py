from pymongo import MongoClient
from config import settings

client = MongoClient(settings.MONGODB_URI)
db = client["pr_db"]

pr_collection = db["pull_requests"]