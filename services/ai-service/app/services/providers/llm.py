"""LLM providers behind a single Protocol.

``FakeLLM`` produces a deterministic, extractive answer from the retrieved
context (no external call, fully grounded by construction) so the whole agent
pipeline runs and is tested without a key. ``OpenAILLM`` synthesises a fluent
answer when a key is configured. Both take the same (query, context) inputs, so
the answer-generator agent is agnostic to which is active.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass
class LLMResult:
    text: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = "fake"


@runtime_checkable
class LLMProvider(Protocol):
    def generate(self, *, query: str, context: str) -> LLMResult: ...


_SYSTEM = (
    "You are CampusBrain, an academic assistant. Answer ONLY from the provided "
    "context. Cite sources as [n]. If the context does not contain the answer, "
    "say you don't have that information. Never invent facts."
)


class FakeLLM:
    """Extractive synthesis: stitch the most relevant context passages together.

    Grounded by construction — every sentence comes from the context — which is
    exactly the behaviour the verification agent expects on the keys-free path.
    """

    model = "extractive-fake"

    def generate(self, *, query: str, context: str) -> LLMResult:
        passages = [block.strip() for block in context.split("\n\n") if block.strip()]
        if not passages:
            return LLMResult(
                text=(
                    "I don't have information on that in your uploaded material yet."
                ),
                model=self.model,
            )
        body = "\n\n".join(passages[:3])
        text = (
            f'Here is what your material says about "{query.strip()}":\n\n{body}'
        )
        return LLMResult(
            text=text,
            prompt_tokens=len(context) // 4,
            completion_tokens=len(text) // 4,
            model=self.model,
        )


class OpenAILLM:
    """Real generation via the OpenAI Chat Completions API."""

    def __init__(self, api_key: str, model: str) -> None:
        from openai import OpenAI  # deferred import

        self._client = OpenAI(api_key=api_key)
        self.model = model

    def generate(self, *, query: str, context: str) -> LLMResult:
        response = self._client.chat.completions.create(
            model=self.model,
            temperature=0.2,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {
                    "role": "user",
                    "content": f"Context:\n{context}\n\nQuestion: {query}",
                },
            ],
        )
        choice = response.choices[0].message.content or ""
        usage = response.usage
        return LLMResult(
            text=choice,
            prompt_tokens=usage.prompt_tokens if usage else 0,
            completion_tokens=usage.completion_tokens if usage else 0,
            model=self.model,
        )
