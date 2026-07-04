"""The api <-> ai RAG contract (v1).

These Pydantic models are the single source of truth for the request/response
shapes exchanged with the NestJS API. The mirrored TypeScript types live in
``packages/shared-types`` and must be kept in sync.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class RetrievalFilters(BaseModel):
    """Metadata filters narrowing retrieval (all optional)."""

    subject_id: str | None = None
    document_ids: list[str] | None = None
    document_type: str | None = None
    year: int | None = None
    unit: str | None = None


class ChatTurn(BaseModel):
    """One prior message in the conversation, for follow-up resolution."""

    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str


class RagQueryRequest(BaseModel):
    request_id: str = Field(..., description="Correlation id from the API edge.")
    user_id: str
    query: str = Field(..., min_length=1, max_length=8_000)
    chat_id: str | None = None
    # Prior turns for conversational context (most recent last).
    history: list[ChatTurn] = Field(default_factory=list)
    filters: RetrievalFilters | None = None
    top_k: int | None = Field(default=None, ge=1, le=50)
    stream: bool = True


class Citation(BaseModel):
    """A retrieved chunk backing part of an answer."""

    vector_id: str
    document_id: str
    chunk_index: int
    content: str
    page_number: int | None = None
    score: float
    title: str | None = None


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    model: str | None = None
    cost_usd: float = 0.0


class RagAnswer(BaseModel):
    """Non-streaming answer payload."""

    request_id: str
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    usage: TokenUsage = Field(default_factory=TokenUsage)
    grounded: bool = Field(
        default=False,
        description="True when the answer is supported by retrieved context.",
    )
    latency_ms: int = 0


class StreamEventType(str, Enum):
    TOKEN = "token"
    CITATIONS = "citations"
    USAGE = "usage"
    DONE = "done"
    ERROR = "error"


class StreamEvent(BaseModel):
    """One Server-Sent Event in the streaming response."""

    type: StreamEventType
    data: dict = Field(default_factory=dict)


RagQueryRequest.model_rebuild()
