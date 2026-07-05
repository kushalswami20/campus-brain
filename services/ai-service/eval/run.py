"""Run the RAG eval and print a scorecard.

    python -m eval.run

Uses local sentence-transformers embeddings + a cross-encoder reranker when
installed (a real score); otherwise falls back to the deterministic fakes.
Exits non-zero if any headline metric is below its threshold, so it can gate CI.
"""

from __future__ import annotations

from app.services.providers.embeddings import (
    EmbeddingProvider,
    FakeEmbeddingProvider,
)

from .harness import CaseResult, Scorecard, evaluate

# Minimum acceptable headline metrics (tune as the corpus grows).
THRESHOLDS = {
    "answer_accuracy": 0.80,
    "refusal_accuracy": 1.00,
    "recall_at_k": 0.70,
    "mrr": 0.60,
}


def _select_embeddings() -> tuple[EmbeddingProvider, str | None, str]:
    """Prefer real local models; fall back to fakes when the lib is absent."""
    try:
        import sentence_transformers  # noqa: F401

        from app.services.providers.embeddings import LocalEmbeddingProvider

        return (
            LocalEmbeddingProvider("sentence-transformers/all-MiniLM-L6-v2"),
            "cross-encoder/ms-marco-MiniLM-L-6-v2",
            "local sentence-transformers + cross-encoder",
        )
    except ImportError:
        label = "hashing fake (install sentence-transformers for a real score)"
        return FakeEmbeddingProvider(), None, label


def _fmt(value: float, threshold: float | None = None) -> str:
    pct = f"{value * 100:5.1f}%"
    if threshold is None:
        return pct
    return f"{pct}  {'PASS' if value >= threshold else 'FAIL'}"


def _print_cases(results: list[CaseResult]) -> None:
    print("\nPer-case results")
    print("-" * 78)
    print(f"{'decision':8}  {'kind':13}  {'r@k':4} {'rr':4}  query")
    for r in results:
        decided = "answer" if r.grounded else "refuse"
        mark = "ok " if r.decision_ok else "MISS"
        recall = "-" if r.recall is None else f"{r.recall:.0f}"
        rr = "-" if r.reciprocal_rank is None else f"{r.reciprocal_rank:.2f}"
        print(
            f"{decided:6}{mark:2}  {r.case.kind.value:13}  "
            f"{recall:>3}  {rr:>4}  {r.case.query}"
        )


def _print_summary(card: Scorecard) -> None:
    print("\nScorecard")
    print("-" * 78)
    print(f"  Answer accuracy (in-scope + broad) : "
          f"{_fmt(card.answer_accuracy, THRESHOLDS['answer_accuracy'])}")
    print(f"  Refusal accuracy (out-of-scope)    : "
          f"{_fmt(card.refusal_accuracy, THRESHOLDS['refusal_accuracy'])}")
    print(f"  Retrieval recall@k (in-scope)      : "
          f"{_fmt(card.recall_at_k, THRESHOLDS['recall_at_k'])}")
    print(f"  MRR (in-scope)                     : "
          f"{_fmt(card.mrr, THRESHOLDS['mrr'])}")


def main() -> int:
    embeddings, reranker_model, label = _select_embeddings()
    print(f"Providers: {label}")
    card = evaluate(embeddings, reranker_model=reranker_model)

    _print_cases(card.results)
    _print_summary(card)

    metrics = {
        "answer_accuracy": card.answer_accuracy,
        "refusal_accuracy": card.refusal_accuracy,
        "recall_at_k": card.recall_at_k,
        "mrr": card.mrr,
    }
    failures = [k for k, v in metrics.items() if v < THRESHOLDS[k]]
    print("-" * 78)
    if failures:
        print(f"RESULT: FAIL ({', '.join(failures)} below threshold)")
        return 1
    print("RESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
