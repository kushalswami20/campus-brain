"""Reasoning agent — context compression and assembly.

Builds the grounded context the generator sees: dedupes near-identical passages,
drops weak matches, and trims to a token budget so the prompt stays focused
(context compression / optimisation). Passages are numbered so the generator and
citation agent can reference them as [n].
"""

from __future__ import annotations

import re

from .state import RagState, Retrieved

_TOKEN_RE = re.compile(r"[a-z0-9]+")


class ReasoningAgent:
    name = "reasoning"

    def __init__(self, max_context_tokens: int = 1200) -> None:
        self._budget_chars = max_context_tokens * 4

    def __call__(self, state: RagState) -> RagState:
        reranked = state.get("reranked", [])
        selected: list[Retrieved] = []
        seen: list[set[str]] = []
        used_chars = 0

        for item in reranked:
            tokens = set(_TOKEN_RE.findall(item["content"].lower()))
            if any(self._too_similar(tokens, prior) for prior in seen):
                continue
            if used_chars + len(item["content"]) > self._budget_chars and selected:
                break
            selected.append(item)
            seen.append(tokens)
            used_chars += len(item["content"])

        context = "\n\n".join(
            f"[{i + 1}] {item['content'].strip()}"
            for i, item in enumerate(selected)
        )
        return {
            "reranked": selected,
            "context": context,
            "trace": [*state.get("trace", []), self.name],
        }

    @staticmethod
    def _too_similar(a: set[str], b: set[str]) -> bool:
        if not a or not b:
            return False
        overlap = len(a & b) / min(len(a), len(b))
        return overlap > 0.9
