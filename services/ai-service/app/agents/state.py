"""Shared state passed between agents in the LangGraph pipeline.

Each agent node receives the state and returns a partial dict that LangGraph
merges in. Keeping every intermediate (subqueries, dense/sparse matches, fused,
reranked, context, verification, reflection) on the state makes the pipeline
fully inspectable — the agent trace we surface to the client and the analytics.
"""

from __future__ import annotations

from typing import Any, TypedDict


class Retrieved(TypedDict):
    vector_id: str
    document_id: str
    chunk_index: int
    content: str
    score: float
    metadata: dict[str, Any]


class RagState(TypedDict, total=False):
    # Inputs
    request_id: str
    query: str
    filters: dict[str, Any] | None
    top_k: int

    # Planner
    subqueries: list[str]
    plan: dict[str, Any]

    # Retrieval
    dense: list[Retrieved]
    sparse: list[Retrieved]
    fused: list[Retrieved]
    reranked: list[Retrieved]

    # Reasoning / generation
    context: str
    answer: str
    grounded: bool
    citations: list[dict[str, Any]]
    usage: dict[str, Any]

    # Verification & reflection
    verification: dict[str, Any]
    reflection: dict[str, Any]
    iterations: int

    # Trace of agents that ran, for observability.
    trace: list[str]
