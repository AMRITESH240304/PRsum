from fastapi import APIRouter, HTTPException
from services.fetch_pr import fetch_pr_public
from services.save_pr import save_pr_to_mongo
from services.sse import pr_stream_generator
from sse_starlette.sse import EventSourceResponse

router = APIRouter()


@router.get("/hello")
def say_hello():
    return {"message": "Hello from another route!"}

@router.get("/summarize-pr")
def fetch_pr(pr_url: str):
    try:
        data = fetch_pr_public(pr_url)
        save_pr_to_mongo(data)
        return {"message": "PR stored successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 🔥 SSE Streaming API
@router.get("/stream-pr")
async def stream_pr(pr_url: str):
    return EventSourceResponse(
        pr_stream_generator(
            pr_url,
            fetch_pr_public,
            save_pr_to_mongo
        )
    )