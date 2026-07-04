"""Embedding providers behind a single Protocol.

Dependency inversion: the ingestion and retrieval code depends on the
``EmbeddingProvider`` interface, never on a concrete SDK. ``FakeEmbeddingProvider``
gives deterministic, dependency-free vectors so the whole pipeline runs and is
tested locally; ``OpenAIEmbeddingProvider`` is selected automatically when a key
is configured (its SDK import is deferred so the fake path needs nothing).
"""

from __future__ import annotations

import hashlib
import math
import re
from typing import Protocol, runtime_checkable

_TOKEN_RE = re.compile(r"[a-z0-9]+")


@runtime_checkable
class EmbeddingProvider(Protocol):
    dimension: int

    def embed(self, texts: list[str]) -> list[list[float]]: ...

    def embed_one(self, text: str) -> list[float]: ...


class FakeEmbeddingProvider:
    """Deterministic bag-of-words hashing embedding.

    Each token is hashed into a bucket of a fixed-dimension vector; the result is
    L2-normalized. Cosine similarity then reflects token overlap — good enough for
    a meaningful local retrieval demo without any external service.
    """

    def __init__(self, dimension: int = 256) -> None:
        self.dimension = dimension

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_one(text) for text in texts]

    def embed_one(self, text: str) -> list[float]:
        vector = [0.0] * self.dimension
        for token in _TOKEN_RE.findall(text.lower()):
            bucket = int(hashlib.md5(token.encode()).hexdigest(), 16) % self.dimension
            vector[bucket] += 1.0
        return _normalize(vector)


class OpenAIEmbeddingProvider:
    """Real embeddings via the OpenAI API (used when a key is present)."""

    _DIMENSIONS = {
        "text-embedding-3-large": 3072,
        "text-embedding-3-small": 1536,
    }

    def __init__(self, api_key: str, model: str) -> None:
        from openai import OpenAI  # deferred import — only needed on the real path

        self._client = OpenAI(api_key=api_key)
        self._model = model
        self.dimension = self._DIMENSIONS.get(model, 3072)

    def embed(self, texts: list[str]) -> list[list[float]]:
        response = self._client.embeddings.create(model=self._model, input=texts)
        return [item.embedding for item in response.data]

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]


def _normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(component * component for component in vector))
    if norm == 0.0:
        return vector
    return [component / norm for component in vector]
