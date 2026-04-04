import asyncio
from sse_starlette.sse import EventSourceResponse


async def pr_stream_generator(pr_url: str, fetch_fn, save_fn):
    yield {"event": "message", "data": "Fetching PR..."}

    data = fetch_fn(pr_url)

    yield {"event": "message", "data": "Saving to DB..."}
    save_fn(data)

    # Stream files one by one (agent-style)
    for f in data["files"]:
        await asyncio.sleep(0.1)
        yield {
            "event": "file",
            "data": f"{f['filename']} (+{f['additions']} -{f['deletions']})"
        }

    yield {"event": "done", "data": "Completed"}