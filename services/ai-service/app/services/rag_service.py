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
    RetrievalFilters,
    StreamEvent,
    StreamEventType,
    TokenUsage,
)
from app.services.providers.embeddings import EmbeddingProvider
from app.services.providers.vector_store import VectorStore

logger = get_logger(__name__)


class RagService:
    def __init__(
        self,
        settings: Settings,
        embeddings: EmbeddingProvider,
        vector_store: VectorStore,
    ) -> None:
        self._settings = settings
        self._embeddings = embeddings
        self._store = vector_store

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
        """Dense retrieval over the vector store, with metadata filtering.

        Multi-agent hybrid retrieval (BM25 + dense), reranking, and compression
        layer on top of this in Milestone 5 behind the same signature.
        """
        query_vector = self._embeddings.embed_one(request.query)
        top_k = request.top_k or self._settings.default_top_k
        matches = self._store.query(
            query_vector, top_k=top_k, flt=self._build_filter(request.filters)
        )

        # Drop weak matches so an unrelated corpus doesn't force a false "grounded".
        threshold = 0.05
        citations: list[Citation] = []
        for match in matches:
            if match.score < threshold:
                continue
            meta = match.metadata
            citations.append(
                Citation(
                    vector_id=match.vector_id,
                    document_id=str(meta.get("document_id", "")),
                    chunk_index=int(meta.get("chunk_index", 0)),
                    content=str(meta.get("content", "")),
                    page_number=meta.get("page_number"),
                    score=round(match.score, 4),
                    title=meta.get("topic") or meta.get("document_id"),
                )
            )
        return citations

    @staticmethod
    def _build_filter(filters: RetrievalFilters | None) -> dict | None:
        if not filters:
            return None
        built: dict = {}
        if filters.subject_id:
            built["subject_id"] = filters.subject_id
        if filters.document_type:
            built["document_type"] = filters.document_type
        if filters.year:
            built["year"] = filters.year
        if filters.unit:
            built["unit"] = filters.unit
        return built or None

    def _compose(self, request: RagQueryRequest, citations: list[Citation]) -> str:
        if not citations:
            return (
                "I can only answer from your uploaded course material, and I "
                "don't have any indexed documents relevant to this question yet. "
                "Upload notes, papers, or a syllabus and ask again.\n\n"
                f'(You asked: "{request.query.strip()}")'
            )

        # Extractive, grounded synthesis. When an LLM key is present (M5) this is
        # replaced by the multi-agent answer generator; the citations it cites are
        # exactly these retrieved chunks, keeping answers verifiable.
        top = citations[: min(3, len(citations))]
        excerpts = "\n\n".join(
            f"[{i + 1}] {c.content.strip()}" for i, c in enumerate(top)
        )
        sources = ", ".join(sorted({c.title or c.document_id for c in top}))
        return (
            f'Based on your uploaded material ({sources}), here is what is most '
            f'relevant to "{request.query.strip()}":\n\n{excerpts}'
        )

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        """Split into word-ish tokens so the client renders progressively."""
        parts: list[str] = []
        for word in text.split(" "):
            parts.append(word + " ")
        return parts
