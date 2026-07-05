"""The scoring engine: build a pipeline over the golden corpus, run each case,
and aggregate retrieval + answer-decision metrics into a Scorecard."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.agents.graph import PipelineResult, RagPipeline
from app.services.providers.embeddings import (
    EmbeddingProvider,
    FakeEmbeddingProvider,
)
from app.services.providers.keyword_index import InMemoryBM25Index
from app.services.providers.llm import FakeLLM
from app.services.providers.vector_store import InMemoryVectorStore, VectorRecord

from .dataset import CASES, CORPUS, Case, Kind


@dataclass
class CaseResult:
    case: Case
    grounded: bool
    decision_ok: bool  # did grounded match the expectation?
    recall: float | None = None  # in-scope only: expected doc among citations?
    reciprocal_rank: float | None = None  # in-scope only: 1/rank of first hit


@dataclass
class Scorecard:
    results: list[CaseResult] = field(default_factory=list)

    def _mean(self, values: list[float]) -> float:
        return sum(values) / len(values) if values else 0.0

    @property
    def recall_at_k(self) -> float:
        vals = [r.recall for r in self.results if r.recall is not None]
        return self._mean(vals)

    @property
    def mrr(self) -> float:
        vals = [
            r.reciprocal_rank
            for r in self.results
            if r.reciprocal_rank is not None
        ]
        return self._mean(vals)

    def _decision(self, kinds: set[Kind]) -> float:
        vals = [
            1.0 if r.decision_ok else 0.0
            for r in self.results
            if r.case.kind in kinds
        ]
        return self._mean(vals)

    @property
    def answer_accuracy(self) -> float:  # in-scope + broad should answer
        return self._decision({Kind.IN_SCOPE, Kind.BROAD})

    @property
    def refusal_accuracy(self) -> float:  # out-of-scope should refuse
        return self._decision({Kind.OUT_OF_SCOPE})

    @property
    def decision_accuracy(self) -> float:
        return self._decision({Kind.IN_SCOPE, Kind.BROAD, Kind.OUT_OF_SCOPE})


def build_pipeline(
    embeddings: EmbeddingProvider,
    *,
    reranker_model: str | None,
    min_relevance: float,
) -> RagPipeline:
    """Ingest the golden corpus into fresh in-memory stores and wire a pipeline."""
    store = InMemoryVectorStore()
    keywords = InMemoryBM25Index()
    for doc_id, chunks in CORPUS.items():
        for idx, text in enumerate(chunks):
            vid = f"{doc_id}:{idx}"
            meta = {
                "document_id": doc_id,
                "chunk_index": idx,
                "content": text,
                "topic": doc_id,
            }
            store.upsert([VectorRecord(vid, embeddings.embed_one(text), meta)])
            keywords.add(vid, text, meta)

    return RagPipeline(
        embeddings=embeddings,
        vector_store=store,
        keyword_index=keywords,
        llm=FakeLLM(),
        reranker_model=reranker_model,
        min_relevance=min_relevance,
    )


def _score_case(case: Case, result: PipelineResult) -> CaseResult:
    should_answer = case.kind in (Kind.IN_SCOPE, Kind.BROAD)
    decision_ok = result.grounded == should_answer

    recall: float | None = None
    rr: float | None = None
    if case.kind is Kind.IN_SCOPE and case.expected_docs:
        ranked_docs = [c["document_id"] for c in result.citations]
        recall = 1.0 if any(d in case.expected_docs for d in ranked_docs) else 0.0
        rr = 0.0
        for position, doc_id in enumerate(ranked_docs, start=1):
            if doc_id in case.expected_docs:
                rr = 1.0 / position
                break

    return CaseResult(
        case=case,
        grounded=result.grounded,
        decision_ok=decision_ok,
        recall=recall,
        reciprocal_rank=rr,
    )


def evaluate(
    embeddings: EmbeddingProvider | None = None,
    *,
    reranker_model: str | None = None,
    min_relevance: float = 0.30,
    top_k: int = 8,
    cases: list[Case] | None = None,
) -> Scorecard:
    """Run the golden set and return a Scorecard. Defaults to the keys-free
    fake embeddings; pass a LocalEmbeddingProvider + reranker for a real score."""
    embeddings = embeddings or FakeEmbeddingProvider()
    pipeline = build_pipeline(
        embeddings, reranker_model=reranker_model, min_relevance=min_relevance
    )
    card = Scorecard()
    for i, case in enumerate(cases or CASES):
        result = pipeline.run(
            request_id=f"eval-{i}", query=case.query, filters=None, top_k=top_k
        )
        card.results.append(_score_case(case, result))
    return card
