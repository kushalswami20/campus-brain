"""Answer generator agent — produces the answer from the compressed context.

Delegates to the LLM provider (real OpenAI when a key is present, extractive fake
otherwise). It refuses instead of guessing when either there is no context OR the
retrieved passages aren't relevant enough to the question (the relevance gate) —
the anti-hallucination contract enforced at the source of generation.
"""

from __future__ import annotations

from app.services.providers.llm import LLMProvider

from .state import RagState

_REFUSAL = (
    "I can only answer from your uploaded course material, and I couldn't find "
    "anything relevant to this question. Try uploading related notes or papers."
)


class AnswerGeneratorAgent:
    name = "answer_generator"

    def __init__(self, llm: LLMProvider, min_relevance: float = 0.0) -> None:
        self._llm = llm
        # Below this top-passage relevance, treat the question as out-of-scope
        # and refuse. 0.0 disables the gate (used by the keys-free defaults).
        self._min_relevance = min_relevance

    def __call__(self, state: RagState) -> RagState:
        context = state.get("context", "").strip()
        # Absent relevance (e.g. no reranker ran) defaults to 1.0 so the gate
        # only ever *adds* refusals, never suppresses a legitimate answer.
        relevance = float(state.get("relevance", 1.0))
        if not context or relevance < self._min_relevance:
            return {
                "answer": _REFUSAL,
                "grounded": False,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "trace": [*state.get("trace", []), self.name],
            }

        result = self._llm.generate(query=state["query"], context=context)
        return {
            "answer": result.text,
            "grounded": True,
            "usage": {
                "prompt_tokens": result.prompt_tokens,
                "completion_tokens": result.completion_tokens,
                "model": result.model,
            },
            "trace": [*state.get("trace", []), self.name],
        }
