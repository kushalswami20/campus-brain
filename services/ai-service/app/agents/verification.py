"""Verification agent — hallucination detection / grounding check.

Measures how much of the answer is actually supported by the retrieved context.
A low support score means the answer drifted from its sources; the reflection
agent uses this to decide whether to retry or downgrade the grounded flag.
"""

from __future__ import annotations

import re

from .state import RagState

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_STOP = {"the", "a", "an", "is", "are", "of", "to", "in", "and", "or", "for"}
_SUPPORT_THRESHOLD = 0.6


class VerificationAgent:
    name = "verification"

    def __call__(self, state: RagState) -> RagState:
        answer = state.get("answer", "")
        context = state.get("context", "")

        if not state.get("grounded", False) or not context:
            return {
                "verification": {"supported": False, "support_score": 0.0},
                "trace": [*state.get("trace", []), self.name],
            }

        answer_terms = self._content_terms(answer)
        context_terms = self._content_terms(context)
        if not answer_terms:
            score = 0.0
        else:
            score = len(answer_terms & context_terms) / len(answer_terms)

        supported = score >= _SUPPORT_THRESHOLD
        return {
            "verification": {
                "supported": supported,
                "support_score": round(score, 3),
            },
            "grounded": supported,
            "trace": [*state.get("trace", []), self.name],
        }

    @staticmethod
    def _content_terms(text: str) -> set[str]:
        return {
            token
            for token in _TOKEN_RE.findall(text.lower())
            if token not in _STOP and len(token) > 2
        }
