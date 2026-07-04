"""RAG service.

Milestone 3 provides a deterministic streaming stub so the full transport path
(NestJS -> AI -> streamed tokens -> NestJS -> web) can be built and tested
without any paid providers. The real multi-agent LangGraph pipeline replaces
``_generate`` in Milestone 5; the public interface here is already its contract.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator

from app.core.config import Settings
from app.core.logging import get_logger
from app.schemas.rag import (
    Citation,
    RagAnswer,
    RagQueryRequest,
    StreamEvent,
    StreamEventType,
    TokenUsage,
)

logger = get_logger(__name__)


class RagService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def answer_stream(
        self, request: RagQueryRequest
    ) -> AsyncIterator[StreamEvent]:
        """Yield SSE events: token* -> citations -> usage -> done."""
        started = time.perf_counter()
        log = logger.bind(request_id=request.request_id, user_id=request.user_id)
        log.info("rag_query_received", query_len=len(request.query), stream=True)

        citations = await self._retrieve(request)
        text = self._compose(request, citations)

        for token in self._tokenize(text):
            yield StreamEvent(type=StreamEventType.TOKEN, data={"text": token})
            # Small delay so streaming is observable end-to-end; negligible cost.
            await asyncio.sleep(0)

        yield StreamEvent(
            type=StreamEventType.CITATIONS,
            data={"citations": [c.model_dump() for c in citations]},
        )
        usage = TokenUsage(model=self._settings.openai_model)
        yield StreamEvent(type=StreamEventType.USAGE, data=usage.model_dump())

        latency_ms = int((time.perf_counter() - started) * 1000)
        yield StreamEvent(
            type=StreamEventType.DONE,
            data={"grounded": bool(citations), "latency_ms": latency_ms},
        )
        log.info("rag_query_completed", latency_ms=latency_ms, grounded=bool(citations))

    async def answer(self, request: RagQueryRequest) -> RagAnswer:
        """Non-streaming variant, assembled from the same generation logic."""
        started = time.perf_counter()
        citations = await self._retrieve(request)
        text = self._compose(request, citations)
        return RagAnswer(
            request_id=request.request_id,
            answer=text,
            citations=citations,
            usage=TokenUsage(model=self._settings.openai_model),
            grounded=bool(citations),
            latency_ms=int((time.perf_counter() - started) * 1000),
        )

    async def _retrieve(self, request: RagQueryRequest) -> list[Citation]:
        """Retrieval is wired to Pinecone in Milestone 4/5.

        Until documents are ingested and providers configured, retrieval returns
        no context — which is the correct, honest behaviour: the composer then
        refuses rather than fabricating sources.
        """
        if not self._settings.providers_ready:
            return []
        # M4/M5: hybrid BM25 + dense retrieval, rerank, compress. Placeholder-free
        # implementation lands with those milestones behind this same signature.
        return []

    def _compose(self, request: RagQueryRequest, citations: list[Citation]) -> str:
        if not citations:
            return (
                "I can only answer from your uploaded course material, and I "
                "don't have any indexed documents relevant to this question yet. "
                "Upload notes, papers, or a syllabus and ask again.\n\n"
                f'(You asked: "{request.query.strip()}")'
            )
        sources = ", ".join(sorted({c.title or c.document_id for c in citations}))
        return (
            f'Based on your material ({sources}), here is a grounded answer to '
            f'"{request.query.strip()}".'
        )

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        """Split into word-ish tokens so the client renders progressively."""
        parts: list[str] = []
        for word in text.split(" "):
            parts.append(word + " ")
        return parts
