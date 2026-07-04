"""Planner agent — analyses the query and plans retrieval.

Responsibilities: multi-query expansion (so retrieval isn't hostage to one
phrasing) and normalising metadata filters. When an LLM is available it can be
used for richer decomposition; the deterministic expansion here is the always-on
baseline.
"""

from __future__ import annotations

import re

from .state import RagState

_STOPWORDS = {
    "the", "a", "an", "is", "are", "what", "how", "why", "of", "to", "in",
    "and", "or", "for", "on", "with", "explain", "describe", "does", "do",
}


class PlannerAgent:
    name = "planner"

    def __call__(self, state: RagState) -> RagState:
        query = state["query"].strip()
        keywords = [
            word
            for word in re.findall(r"[A-Za-z0-9]+", query.lower())
            if word not in _STOPWORDS and len(word) > 2
        ]

        # Original phrasing plus a keyword-focused variant broadens recall.
        subqueries = [query]
        if keywords:
            keyword_query = " ".join(keywords)
            if keyword_query.lower() != query.lower():
                subqueries.append(keyword_query)

        return {
            "subqueries": subqueries,
            "plan": {"keywords": keywords, "filters": state.get("filters")},
            "trace": [*state.get("trace", []), self.name],
        }
