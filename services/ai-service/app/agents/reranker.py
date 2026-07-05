"""Reranker agent — cross-encoder reranking of fused candidates.

Uses a sentence-transformers CrossEncoder when installed (best quality); falls
back to a deterministic lexical reranker otherwise. Reranking reorders the fused
candidates by true query-passage relevance, which fusion alone only approximates.
"""

from __future__ import annotations

import logging
import re

from .state import RagState, Retrieved

_TOKEN_RE = re.compile(r"[a-z0-9]+")
logger = logging.getLogger(__name__)


class RerankerAgent:
    name = "reranker"

    def __init__(self, model_name: str | None = None) -> None:
        self._cross_encoder = self._maybe_load(model_name)

    def __call__(self, state: RagState) -> RagState:
        top_k = state.get("top_k", 8)
        candidates = state.get("fused", []) or state.get("dense", [])
        if not candidates:
            return {
                "reranked": [],
                "relevance": 0.0,
                "trace": [*state.get("trace", []), self.name],
            }

        query = state["query"]
        scores = None
        if self._cross_encoder is not None:
            try:
                scores = self._cross_encoder.predict(
                    [(query, c["content"]) for c in candidates]
                )
            except Exception as exc:  # pragma: no cover - env-dependent
                # A reranker hiccup must never crash the RAG request; degrade to
                # the lexical scorer for this query instead.
                logger.warning(
                    "Reranker: cross-encoder predict failed (%s); using lexical "
                    "fallback for this query.",
                    exc,
                )

        if scores is not None:
            ranked = [
                {**c, "score": round(float(score), 6)}
                for c, score in zip(candidates, scores, strict=True)
            ]
        else:
            ranked = [
                {**c, "score": round(self._lexical_score(query, c), 6)}
                for c in candidates
            ]

        # Relevance-gate signal = the strongest dense cosine similarity. The
        # cross-encoder is excellent at *ordering* but its absolute scores are an
        # unreliable relevance threshold (it under-scores valid paraphrased
        # questions), so the gate uses the stable dense cosine instead.
        dense = state.get("dense", [])
        relevance = float(dense[0]["score"]) if dense else 0.0

        ranked.sort(key=lambda c: c["score"], reverse=True)
        return {
            "reranked": ranked[:top_k],  # type: ignore[typeddict-item]
            "relevance": round(relevance, 4),
            "trace": [*state.get("trace", []), self.name],
        }

    @staticmethod
    def _lexical_score(query: str, candidate: Retrieved) -> float:
        q = set(_TOKEN_RE.findall(query.lower()))
        c = set(_TOKEN_RE.findall(candidate["content"].lower()))
        if not q or not c:
            return 0.0
        overlap = len(q & c) / len(q)
        # Blend query coverage with the fused retrieval score.
        return 0.7 * overlap + 0.3 * float(candidate.get("score", 0.0))

    @staticmethod
    def _maybe_load(model_name: str | None):  # type: ignore[no-untyped-def]
        if not model_name:
            logger.info("Reranker: no RERANKER_MODEL set; using lexical fallback.")
            return None
        try:
            from sentence_transformers import CrossEncoder

            model = CrossEncoder(model_name)
            # transformers>=4.5x lazily places weights on the 'meta' device;
            # sentence-transformers 3.x then fails to move them across threads
            # (the server runs the graph in a worker thread, separate from the
            # one that loaded the model). A warm-up predict here forces eager
            # materialization now, so per-request predicts never touch meta.
            model.predict([("warmup", "warmup")])
            logger.info("Reranker: loaded cross-encoder '%s'.", model_name)
            return model
        except Exception as exc:  # pragma: no cover - env-dependent
            logger.warning(
                "Reranker: failed to load '%s' (%s); using lexical fallback.",
                model_name,
                exc,
            )
            return None
