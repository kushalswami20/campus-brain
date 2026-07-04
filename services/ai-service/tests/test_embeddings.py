"""Tests for the embedding providers.

The fake provider is always exercised; the local sentence-transformers provider
is only tested when the (heavy, optional) dependency is installed, so CI without
it stays fast.
"""

from __future__ import annotations

import math

import pytest

from app.services.providers.embeddings import FakeEmbeddingProvider


def _cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=True))


def test_fake_embedding_is_unit_length() -> None:
    provider = FakeEmbeddingProvider()
    vector = provider.embed_one("cohort experiment")
    assert len(vector) == provider.dimension
    assert math.isclose(_cosine(vector, vector), 1.0, abs_tol=1e-6)


def test_fake_embedding_reflects_token_overlap() -> None:
    provider = FakeEmbeddingProvider()
    base = provider.embed_one("cohort experiment control arm")
    similar = provider.embed_one("cohort experiment control")
    unrelated = provider.embed_one("banana yellow fruit")
    assert _cosine(base, similar) > _cosine(base, unrelated)


def test_local_embedding_captures_semantics() -> None:
    """Semantic model should rank a paraphrase above an unrelated sentence."""
    pytest.importorskip("sentence_transformers")
    from app.services.providers.embeddings import LocalEmbeddingProvider

    provider = LocalEmbeddingProvider("sentence-transformers/all-MiniLM-L6-v2")
    cohort = provider.embed_one("a cohort is a group of users in an experiment")
    paraphrase = provider.embed_one("a set of people grouped for a test")
    unrelated = provider.embed_one("bananas are a sweet yellow fruit")

    assert provider.dimension == len(cohort) > 0
    # Semantics, not shared words: 'cohort' and 'group of people' overlap in
    # meaning, not tokens — the hashing fake would miss this, the model shouldn't.
    assert _cosine(cohort, paraphrase) > _cosine(cohort, unrelated)
