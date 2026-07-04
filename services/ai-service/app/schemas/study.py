"""The api <-> ai study-tools contract (v1)."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.rag import Citation, RetrievalFilters


class StudyRequest(BaseModel):
    request_id: str
    user_id: str
    # Topic/prompt to focus on; empty ⇒ summarise the whole (filtered) corpus.
    topic: str = Field(default="", max_length=2_000)
    filters: RetrievalFilters | None = None
    count: int = Field(default=8, ge=1, le=30)


class SummaryResponse(BaseModel):
    request_id: str
    summary: str
    key_points: list[str] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    grounded: bool = False


class Flashcard(BaseModel):
    question: str
    answer: str


class FlashcardsResponse(BaseModel):
    request_id: str
    flashcards: list[Flashcard] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    grounded: bool = False


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    answer_index: int
    explanation: str = ""


class QuizResponse(BaseModel):
    request_id: str
    questions: list[QuizQuestion] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    grounded: bool = False
