"""Answer generator agent — produces the answer from the compressed context.

Delegates to the LLM provider (real OpenAI when a key is present, extractive fake
otherwise). If there is no context, it refuses instead of guessing — the
anti-hallucination contract enforced at the source of generation.
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

    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

    def __call__(self, state: RagState) -> RagState:
        context = state.get("context", "").strip()
        if not context:
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
