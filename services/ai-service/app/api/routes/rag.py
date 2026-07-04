"""RAG query endpoints — streaming (SSE) and non-streaming."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.deps import RagServiceDep, verify_service_key
from app.schemas.rag import RagAnswer, RagQueryRequest, StreamEvent

router = APIRouter(
    prefix="/v1/rag",
    tags=["rag"],
    dependencies=[Depends(verify_service_key)],
)


def _sse(event: StreamEvent) -> str:
    """Serialize an event as an SSE frame: ``event:`` + ``data:`` lines."""
    payload = json.dumps(event.data, ensure_ascii=False)
    return f"event: {event.type.value}\ndata: {payload}\n\n"


@router.post("/query")
async def query_stream(
    request: RagQueryRequest,
    rag: RagServiceDep,
) -> StreamingResponse:
    """Stream the answer as Server-Sent Events (token/citations/usage/done)."""

    async def event_source() -> AsyncIterator[str]:
        async for event in rag.answer_stream(request):
            yield _sse(event)

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "x-request-id": request.request_id,
        },
    )


@router.post("/query/sync", response_model=RagAnswer)
async def query_sync(request: RagQueryRequest, rag: RagServiceDep) -> RagAnswer:
    """Non-streaming answer for callers that want a single JSON payload."""
    return await rag.answer(request)
