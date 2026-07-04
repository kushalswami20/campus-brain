"""Sparse (keyword) index — the BM25 half of hybrid retrieval.

Populated alongside dense vectors during ingestion; queried by the hybrid-search
agent. The in-memory BM25 implementation is process-local (matching the
InMemoryVectorStore) and rebuilds its index lazily when the corpus changes.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

from rank_bm25 import BM25Okapi

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


@dataclass
class KeywordHit:
    vector_id: str
    score: float
    metadata: dict[str, Any]


@runtime_checkable
class KeywordIndex(Protocol):
    def add(self, vector_id: str, content: str, metadata: dict[str, Any]) -> None: ...

    def search(self, query: str, top_k: int) -> list[KeywordHit]: ...

    def delete_by_document(self, document_id: str) -> None: ...


class InMemoryBM25Index:
    def __init__(self) -> None:
        self._ids: list[str] = []
        self._docs: list[list[str]] = []
        self._meta: dict[str, dict[str, Any]] = {}
        self._bm25: BM25Okapi | None = None
        self._dirty = False

    def add(self, vector_id: str, content: str, metadata: dict[str, Any]) -> None:
        self._ids.append(vector_id)
        self._docs.append(_tokenize(content))
        self._meta[vector_id] = metadata
        self._dirty = True

    def search(self, query: str, top_k: int) -> list[KeywordHit]:
        if not self._ids:
            return []
        self._ensure_index()
        assert self._bm25 is not None
        scores = self._bm25.get_scores(_tokenize(query))
        top = max(scores) if len(scores) else 0.0
        hits = [
            KeywordHit(
                vector_id=self._ids[i],
                # Normalise to 0..1 so fusion with dense scores is comparable.
                score=(scores[i] / top) if top > 0 else 0.0,
                metadata=self._meta[self._ids[i]],
            )
            for i in range(len(self._ids))
            if scores[i] > 0
        ]
        hits.sort(key=lambda hit: hit.score, reverse=True)
        return hits[:top_k]

    def delete_by_document(self, document_id: str) -> None:
        keep = [
            i
            for i, vid in enumerate(self._ids)
            if self._meta[vid].get("document_id") != document_id
        ]
        self._ids = [self._ids[i] for i in keep]
        self._docs = [self._docs[i] for i in keep]
        self._meta = {vid: self._meta[vid] for vid in self._ids}
        self._dirty = True

    def _ensure_index(self) -> None:
        if self._dirty or self._bm25 is None:
            self._bm25 = BM25Okapi(self._docs)
            self._dirty = False
