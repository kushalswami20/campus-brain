"""Fast checks that the eval harness computes sane metrics.

Uses the deterministic fake embeddings so CI stays quick; the real-model score
is produced by `python -m eval.run`. We assert the robust invariants (structure,
out-of-scope refusal, broad answers) rather than absolute retrieval numbers,
which depend on the embedding model.
"""

from __future__ import annotations

import pytest

from eval.dataset import CASES, Kind
from eval.harness import Scorecard, evaluate


def _real_eval() -> Scorecard:
    """Evaluate with the real local embeddings + cross-encoder (the setup the
    relevance gate is tuned for). Skips when the models aren't installed."""
    pytest.importorskip("sentence_transformers")
    from app.services.providers.embeddings import LocalEmbeddingProvider

    return evaluate(
        LocalEmbeddingProvider("sentence-transformers/all-MiniLM-L6-v2"),
        reranker_model="cross-encoder/ms-marco-MiniLM-L-6-v2",
    )


def test_harness_runs_and_scores_every_case() -> None:
    card = evaluate()  # fake embeddings — just checks the mechanics
    assert isinstance(card, Scorecard)
    assert len(card.results) == len(CASES)
    for value in (card.recall_at_k, card.mrr, card.decision_accuracy):
        assert 0.0 <= value <= 1.0


def test_broad_summary_cases_are_answered() -> None:
    # The broad-query gate bypass doesn't depend on the embedding model.
    card = evaluate()
    broad = [r for r in card.results if r.case.kind is Kind.BROAD]
    assert broad and all(r.grounded for r in broad)


def test_real_pipeline_refuses_out_of_scope_and_retrieves_in_scope() -> None:
    card = _real_eval()
    assert card.refusal_accuracy == 1.0  # every off-topic question refused
    assert card.answer_accuracy >= 0.8  # in-scope + broad questions answered
    assert card.recall_at_k >= 0.7  # expected doc retrieved most of the time
