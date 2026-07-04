"""RAG service — thin adapter over the multi-agent LangGraph pipeline.

Owns transport concerns (streaming vs sync, wire schemas); the actual retrieval,
reasoning, generation, verification, and citation live in the agent graph
(``app/agents``). The graph runs to completion, then the answer is tokenised for
the streaming response.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator

from app.agents.graph import PipelineResult, RagPipeline
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

logger = get_logger(__name__)


class RagService:
    def __init__(self, settings: Settings, pipeline: RagPipeline) -> None:
        self._settings = settings
        self._pipeline = pipeline

    async def answer_stream(
        self, request: RagQueryRequest
    ) -> AsyncIterator[StreamEvent]:
        started = time.perf_counter()
        log = logger.bind(request_id=request.request_id, user_id=request.user_id)
        log.info("rag_query_received", query_len=len(request.query), stream=True)

        result = await self._run(request)

        for token in self._tokenize(result.answer):
            yield StreamEvent(type=StreamEventType.TOKEN, data={"text": token})
            await asyncio.sleep(0)

        yield StreamEvent(
            type=StreamEventType.CITATIONS,
            data={"citations": [c.model_dump() for c in self._citations(result)]},
        )
        yield StreamEvent(
            type=StreamEventType.USAGE, data=self._usage(result).model_dump()
        )

        latency_ms = int((time.perf_counter() - started) * 1000)
        yield StreamEvent(
            type=StreamEventType.DONE,
            data={
                "grounded": result.grounded,
                "latency_ms": latency_ms,
                "trace": result.trace,
            },
        )
        log.info(
            "rag_query_completed",
            latency_ms=latency_ms,
            grounded=result.grounded,
            trace=result.trace,
        )

    async def answer(self, request: RagQueryRequest) -> RagAnswer:
        started = time.perf_counter()
        result = await self._run(request)
        return RagAnswer(
            request_id=request.request_id,
            answer=result.answer,
            citations=self._citations(result),
            usage=self._usage(result),
            grounded=result.grounded,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )

    async def _run(self, request: RagQueryRequest) -> PipelineResult:
        # The graph is synchronous CPU work; run it off the event loop.
        return await asyncio.to_thread(
            self._pipeline.run,
            request_id=request.request_id,
            query=request.query,
            filters=self._build_filter(request.filters),
            top_k=request.top_k or self._settings.default_top_k,
            history=[turn.model_dump() for turn in request.history],
        )

    def _usage(self, result: PipelineResult) -> TokenUsage:
        prompt = int(result.usage.get("prompt_tokens", 0))
        completion = int(result.usage.get("completion_tokens", 0))
        return TokenUsage(
            prompt_tokens=prompt,
            completion_tokens=completion,
            total_tokens=prompt + completion,
            model=result.usage.get("model", self._settings.openai_model),
        )

    @staticmethod
    def _citations(result: PipelineResult) -> list[Citation]:
        return [Citation(**c) for c in result.citations]

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

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        return [word + " " for word in text.split(" ")]
