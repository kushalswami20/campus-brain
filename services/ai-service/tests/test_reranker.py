"""Tests for the reranker agent.

The lexical fallback is always exercised. The cross-encoder path is only tested
when sentence-transformers is installed (heavy), so CI without it stays fast.
"""

from __future__ import annotations

import pytest

from app.agents.reranker import RerankerAgent

_CANDIDATES = [
    {
        "vector_id": "d:0",
        "document_id": "d",
        "chunk_index": 0,
        "score": 0.9,
        "metadata": {},
        "content": "Level n can hold up to n constituents in the cascade.",
    },
    {
        "vector_id": "d:1",
        "document_id": "d",
        "chunk_index": 1,
        "score": 0.4,
        "metadata": {},
        "content": (
            "Each user is deterministically hashed into exactly one cohort for "
            "the experiment."
        ),
    },
]
_QUERY = "how are users assigned to experiment groups"


def _state() -> dict:
    return {"query": _QUERY, "fused": _CANDIDATES, "top_k": 5, "trace": []}


def test_lexical_reranker_runs_without_a_model() -> None:
    agent = RerankerAgent(None)
    assert agent._cross_encoder is None
    out = agent(_state())
    assert len(out["reranked"]) == 2
    assert "reranker" in out["trace"]


def test_cross_encoder_promotes_the_semantically_relevant_passage() -> None:
    pytest.importorskip("sentence_transformers")
    agent = RerankerAgent("cross-encoder/ms-marco-MiniLM-L-6-v2")
    assert agent._cross_encoder is not None

    ranked = agent(_state())["reranked"]
    # The cohort passage answers the query despite sharing no keywords with it,
    # so the cross-encoder must rank it above the token-heavy 'constituents' noise.
    assert ranked[0]["vector_id"] == "d:1"
