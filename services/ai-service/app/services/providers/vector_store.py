"""Vector store providers behind a single Protocol.

``InMemoryVectorStore`` is a process-local cosine-similarity index used for tests
and the keys-free local demo; ``PineconeVectorStore`` is the production backend,
selected when a Pinecone key is configured. Both honour the same interface, so
ingestion and retrieval are agnostic to which is active.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass
class VectorRecord:
    vector_id: str
    values: list[float]
    metadata: dict = field(default_factory=dict)


@dataclass
class ScoredMatch:
    vector_id: str
    score: float
    metadata: dict


@runtime_checkable
class VectorStore(Protocol):
    def upsert(self, records: list[VectorRecord]) -> None: ...

    def query(
        self, vector: list[float], top_k: int, flt: dict | None = None
    ) -> list[ScoredMatch]: ...

    def delete_by_document(self, document_id: str) -> None: ...


class InMemoryVectorStore:
    def __init__(self) -> None:
        self._records: dict[str, VectorRecord] = {}

    def upsert(self, records: list[VectorRecord]) -> None:
        for record in records:
            self._records[record.vector_id] = record

    def query(
        self, vector: list[float], top_k: int, flt: dict | None = None
    ) -> list[ScoredMatch]:
        matches: list[ScoredMatch] = []
        for record in self._records.values():
            if flt and not _matches_filter(record.metadata, flt):
                continue
            score = _cosine(vector, record.values)
            matches.append(
                ScoredMatch(record.vector_id, score, record.metadata)
            )
        matches.sort(key=lambda match: match.score, reverse=True)
        return matches[:top_k]

    def delete_by_document(self, document_id: str) -> None:
        self._records = {
            vid: rec
            for vid, rec in self._records.items()
            if rec.metadata.get("document_id") != document_id
        }


class PineconeVectorStore:
    """Production vector store. SDK import deferred to the real path only."""

    def __init__(self, api_key: str, index_name: str) -> None:
        from pinecone import Pinecone

        self._index = Pinecone(api_key=api_key).Index(index_name)

    def upsert(self, records: list[VectorRecord]) -> None:
        self._index.upsert(
            vectors=[
                {"id": r.vector_id, "values": r.values, "metadata": r.metadata}
                for r in records
            ]
        )

    def query(
        self, vector: list[float], top_k: int, flt: dict | None = None
    ) -> list[ScoredMatch]:
        result = self._index.query(
            vector=vector,
            top_k=top_k,
            include_metadata=True,
            filter=flt or None,
        )
        return [
            ScoredMatch(m["id"], m["score"], m.get("metadata", {}))
            for m in result.get("matches", [])
        ]

    def delete_by_document(self, document_id: str) -> None:
        self._index.delete(filter={"document_id": {"$eq": document_id}})


def _matches_filter(metadata: dict, flt: dict) -> bool:
    for key, expected in flt.items():
        if metadata.get(key) != expected:
            return False
    return True


def _cosine(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    return dot  # inputs are pre-normalized, so dot product == cosine similarity
