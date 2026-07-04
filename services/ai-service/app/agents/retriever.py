"""Retriever agent — dense retrieval over the vector store.

Runs each planned subquery through the embedding model and the vector store,
then deduplicates by vector id keeping the best score (dense multi-query).
"""

from __future__ import annotations

from app.services.providers.embeddings import EmbeddingProvider
from app.services.providers.vector_store import VectorStore

from .state import RagState, Retrieved


class RetrieverAgent:
    name = "retriever"

    def __init__(
        self, embeddings: EmbeddingProvider, vector_store: VectorStore
    ) -> None:
        self._embeddings = embeddings
        self._store = vector_store

    def __call__(self, state: RagState) -> RagState:
        top_k = state.get("top_k", 8)
        best: dict[str, Retrieved] = {}

        for subquery in state.get("subqueries", [state["query"]]):
            vector = self._embeddings.embed_one(subquery)
            matches = self._store.query(
                vector, top_k=top_k * 2, flt=state.get("filters") or None
            )
            for match in matches:
                meta = match.metadata
                existing = best.get(match.vector_id)
                if existing and existing["score"] >= match.score:
                    continue
                best[match.vector_id] = Retrieved(
                    vector_id=match.vector_id,
                    document_id=str(meta.get("document_id", "")),
                    chunk_index=int(meta.get("chunk_index", 0)),
                    content=str(meta.get("content", "")),
                    score=round(match.score, 4),
                    metadata=meta,
                )

        dense = sorted(best.values(), key=lambda r: r["score"], reverse=True)
        return {
            "dense": dense[: top_k * 2],
            "trace": [*state.get("trace", []), self.name],
        }
