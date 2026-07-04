"""Study-tools generation: summaries, flashcards, quizzes.

All three are grounded in retrieved material (same dense retrieval the RAG
pipeline uses), then shaped into structured output. Generation is heuristic so
it works with no LLM key; when OpenAI is configured the summary prose is
upgraded via the LLM while the structure stays deterministic and citable.
"""

from __future__ import annotations

import re

from app.schemas.rag import Citation, RetrievalFilters
from app.schemas.study import (
    Flashcard,
    FlashcardsResponse,
    QuizQuestion,
    QuizResponse,
    StudyRequest,
    SummaryResponse,
)
from app.services.providers.embeddings import EmbeddingProvider
from app.services.providers.llm import LLMProvider
from app.services.providers.vector_store import VectorStore

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")
_DEFINITION_RE = re.compile(r"^(.{3,60}?)\s+(?:is|are|means|refers to)\s+(.+)$", re.I)
_STOP = {
    "the", "a", "an", "this", "that", "these", "those", "and", "or", "but",
    "for", "with", "within", "from", "into", "each", "only", "its", "their",
}


class StudyService:
    def __init__(
        self,
        embeddings: EmbeddingProvider,
        vector_store: VectorStore,
        llm: LLMProvider,
    ) -> None:
        self._embeddings = embeddings
        self._store = vector_store
        self._llm = llm

    def summarize(self, request: StudyRequest) -> SummaryResponse:
        citations = self._retrieve(request)
        if not citations:
            return SummaryResponse(
                request_id=request.request_id,
                summary=self._empty_message(),
                grounded=False,
            )
        context = "\n\n".join(c.content for c in citations)
        sentences = self._sentences(context)
        key_points = self._dedupe(sentences)[: request.count]
        prose = self._llm.generate(
            query=request.topic or "Summarise the key points of this material.",
            context=context,
        ).text
        return SummaryResponse(
            request_id=request.request_id,
            summary=prose,
            key_points=key_points,
            citations=citations,
            grounded=True,
        )

    def flashcards(self, request: StudyRequest) -> FlashcardsResponse:
        citations = self._retrieve(request)
        sentences = self._dedupe(
            self._sentences("\n\n".join(c.content for c in citations))
        )
        cards: list[Flashcard] = []
        for sentence in sentences:
            if len(cards) >= request.count:
                break
            match = _DEFINITION_RE.match(sentence)
            if match:
                term = match.group(1).strip().rstrip(":")
                cards.append(
                    Flashcard(question=f"What is {term}?", answer=sentence)
                )
            else:
                lead = " ".join(sentence.split()[:8])
                cards.append(
                    Flashcard(question=f"Explain: {lead}…", answer=sentence)
                )
        return FlashcardsResponse(
            request_id=request.request_id,
            flashcards=cards,
            citations=citations,
            grounded=bool(cards),
        )

    def quiz(self, request: StudyRequest) -> QuizResponse:
        citations = self._retrieve(request)
        sentences = self._dedupe(
            self._sentences("\n\n".join(c.content for c in citations))
        )
        terms = self._salient_terms(sentences)
        questions: list[QuizQuestion] = []

        for sentence in sentences:
            if len(questions) >= request.count:
                break
            answer = self._pick_term(sentence, terms)
            if not answer:
                continue
            distractors = [t for t in terms if t != answer][:3]
            if len(distractors) < 3:
                continue
            options = self._shuffle_stable([answer, *distractors], sentence)
            questions.append(
                QuizQuestion(
                    question=self._blank(sentence, answer),
                    options=options,
                    answer_index=options.index(answer),
                    explanation=sentence,
                )
            )
        return QuizResponse(
            request_id=request.request_id,
            questions=questions,
            citations=citations,
            grounded=bool(questions),
        )

    # ── retrieval ──

    def _retrieve(self, request: StudyRequest) -> list[Citation]:
        query = request.topic or "overview summary key concepts definitions"
        vector = self._embeddings.embed_one(query)
        matches = self._store.query(
            vector, top_k=max(request.count, 8), flt=self._filter(request.filters)
        )
        citations: list[Citation] = []
        for match in matches:
            if match.score < 0.02:
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
    def _filter(filters: RetrievalFilters | None) -> dict | None:
        if not filters:
            return None
        built: dict = {}
        if filters.subject_id:
            built["subject_id"] = filters.subject_id
        if filters.document_type:
            built["document_type"] = filters.document_type
        return built or None

    # ── text helpers ──

    @staticmethod
    def _sentences(text: str) -> list[str]:
        out: list[str] = []
        for raw in _SENTENCE_RE.split(text.replace("\n", " ")):
            sentence = raw.strip()
            if 20 <= len(sentence) <= 320:
                out.append(sentence)
        return out

    @staticmethod
    def _dedupe(sentences: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for sentence in sentences:
            key = sentence.lower()[:60]
            if key in seen:
                continue
            seen.add(key)
            out.append(sentence)
        return out

    @staticmethod
    def _salient_terms(sentences: list[str]) -> list[str]:
        counts: dict[str, int] = {}
        for sentence in sentences:
            for word in re.findall(r"[A-Za-z][A-Za-z0-9\-]{4,}", sentence):
                lower = word.lower()
                if lower in _STOP:
                    continue
                counts[word] = counts.get(word, 0) + 1
        ranked = sorted(counts, key=lambda w: (-counts[w], w))
        # Prefer distinct-looking domain terms.
        return ranked[:12]

    @staticmethod
    def _pick_term(sentence: str, terms: list[str]) -> str | None:
        for term in terms:
            if re.search(rf"\b{re.escape(term)}\b", sentence):
                return term
        return None

    @staticmethod
    def _blank(sentence: str, term: str) -> str:
        blanked = re.sub(rf"\b{re.escape(term)}\b", "_____", sentence, count=1)
        return f"Fill in the blank: {blanked}"

    @staticmethod
    def _shuffle_stable(options: list[str], seed: str) -> list[str]:
        # Deterministic ordering keyed by the sentence, so tests are stable.
        return sorted(options, key=lambda o: hash((seed, o)) & 0xFFFF)

    @staticmethod
    def _empty_message() -> str:
        return (
            "There isn't any indexed material matching this yet. Upload related "
            "notes or papers and try again."
        )
