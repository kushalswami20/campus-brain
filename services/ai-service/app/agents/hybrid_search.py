"""Hybrid search agent — fuses dense and sparse (BM25) results.

Combines the retriever's dense hits with BM25 keyword hits using Reciprocal Rank
Fusion (RRF), which blends rankings without needing comparable score scales.
Dense captures semantic similarity; sparse captures exact-term matches (names,
acronyms, formulae) — together they beat either alone.
"""

from __future__ import annotations

from app.services.providers.keyword_index import KeywordIndex

from .state import RagState, Retrieved

_RRF_K = 60


class HybridSearchAgent:
    name = "hybrid_search"

    def __init__(self, keyword_index: KeywordIndex) -> None:
        self._keywords = keyword_index

    def __call__(self, state: RagState) -> RagState:
        top_k = state.get("top_k", 8)
        dense = state.get("dense", [])
        filters = state.get("filters") or None

        # Gather sparse hits across subqueries, keeping best rank per id.
        sparse_by_id: dict[str, Retrieved] = {}
        for subquery in state.get("subqueries", [state["query"]]):
            for hit in self._keywords.search(subquery, top_k=top_k * 2):
                meta = hit.metadata
                # The keyword index isn't filter-aware, so enforce metadata
                # filters here to match the dense side.
                if filters and not self._passes(meta, filters):
                    continue
                if hit.vector_id in sparse_by_id:
                    continue
                sparse_by_id[hit.vector_id] = Retrieved(
                    vector_id=hit.vector_id,
                    document_id=str(meta.get("document_id", "")),
                    chunk_index=int(meta.get("chunk_index", 0)),
                    content=str(meta.get("content", "")),
                    score=round(hit.score, 4),
                    metadata=meta,
                )
        sparse = sorted(
            sparse_by_id.values(), key=lambda r: r["score"], reverse=True
        )

        fused = self._reciprocal_rank_fusion(dense, sparse)
        return {
            "sparse": sparse[: top_k * 2],
            "fused": fused[: top_k * 2],
            "trace": [*state.get("trace", []), self.name],
        }

    @staticmethod
    def _passes(metadata: dict, filters: dict) -> bool:
        return all(metadata.get(key) == value for key, value in filters.items())

    @staticmethod
    def _reciprocal_rank_fusion(
        dense: list[Retrieved], sparse: list[Retrieved]
    ) -> list[Retrieved]:
        scores: dict[str, float] = {}
        record: dict[str, Retrieved] = {}
        for ranking in (dense, sparse):
            for rank, item in enumerate(ranking):
                scores[item["vector_id"]] = scores.get(item["vector_id"], 0.0) + 1.0 / (
                    _RRF_K + rank + 1
                )
                record.setdefault(item["vector_id"], item)

        fused: list[Retrieved] = []
        for vid, fused_score in sorted(
            scores.items(), key=lambda kv: kv[1], reverse=True
        ):
            item = dict(record[vid])
            item["score"] = round(fused_score, 6)
            fused.append(item)  # type: ignore[arg-type]
        return fused
