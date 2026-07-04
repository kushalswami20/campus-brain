"""Reflection agent — self-critique and retry decision.

Closes the loop: if the answer is ungrounded or weakly supported and the retry
budget isn't spent, it broadens the query and signals another retrieval round.
Otherwise it finalises. This is what makes the pipeline agentic rather than a
straight-line RAG chain.
"""

from __future__ import annotations

from .state import RagState

MAX_ITERATIONS = 2


class ReflectionAgent:
    name = "reflection"

    def __call__(self, state: RagState) -> RagState:
        iterations = state.get("iterations", 0) + 1
        verification = state.get("verification", {})
        supported = bool(verification.get("supported", False))

        should_retry = not supported and iterations < MAX_ITERATIONS
        reflection = {
            "should_retry": should_retry,
            "iterations": iterations,
            "reason": (
                "answer insufficiently grounded; broadening retrieval"
                if should_retry
                else "finalised"
            ),
        }

        update: RagState = {
            "iterations": iterations,
            "reflection": reflection,
            "trace": [*state.get("trace", []), self.name],
        }

        if should_retry:
            # Broaden: fold plan keywords into the query for the next round.
            keywords = state.get("plan", {}).get("keywords", [])
            if keywords:
                update["subqueries"] = [state["query"], " ".join(keywords)]
        return update


def should_continue(state: RagState) -> str:
    """Conditional edge: loop back to retrieval or end."""
    reflection = state.get("reflection", {})
    return "retry" if reflection.get("should_retry") else "end"
