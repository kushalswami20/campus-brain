"""Contextualizer agent — resolves follow-up questions against chat history.

Runs first, before planning/retrieval. A context-dependent follow-up such as
"explain that in more detail" or "why?" can't be retrieved on its own — it has no
topic. This agent rewrites it into a standalone query by pulling the topic from
the most recent user turn, either substituting anaphora ("that" → "cohorts") or
appending the topic when there's nothing to substitute.

Deterministic and LLM-free: it only reuses words already present in the
conversation, so it can never invent a new topic. When the query already stands
on its own (or there's no history), it's passed through unchanged.
"""

from __future__ import annotations

import re

from .state import RagState

# Pronouns/determiners that point back at an earlier topic. Deliberately excludes
# "one"/"here" — they collide with phrasing like "in one line" / "what's here".
_ANAPHORA = {
    "it", "its", "that", "this", "these", "those", "they", "them", "their",
    "he", "she", "his", "her",
}
# Cues that a short query is continuing the previous one.
_FOLLOWUP_CUES = re.compile(
    r"\b(more|further|elaborate|expand|continue|again|why|also|else|"
    r"go on|tell me more|what about)\b",
    re.IGNORECASE,
)
# Words describing HOW to answer, not WHAT about — excluded from topic detection.
_INSTRUCTION = {
    "explain", "describe", "detail", "detailed", "depth", "summarise",
    "summarize", "summary", "overview", "tell", "give", "list", "define",
    "definition", "meaning", "more", "further", "elaborate", "expand",
    "continue", "again", "please", "about", "what", "why", "how", "does",
    "the", "and", "for", "with", "full", "long", "short", "brief",
    "paragraph", "point", "points", "bullet", "bullets",
} | _ANAPHORA
_TOKEN = re.compile(r"[A-Za-z0-9]+")
_ANAPHORA_RE = re.compile(
    r"\b(" + "|".join(sorted(_ANAPHORA)) + r")\b", re.IGNORECASE
)


class ContextualizerAgent:
    name = "contextualizer"

    def __call__(self, state: RagState) -> RagState:
        original = state["query"].strip()
        history = state.get("history", []) or []
        rewritten = self._rewrite(original, history)
        return {
            "query": rewritten,
            "original_query": original,
            "trace": [*state.get("trace", []), self.name],
        }

    def _rewrite(self, query: str, history: list[dict]) -> str:
        if not history or not self._is_followup(query):
            return query
        topic = self._prior_topic(history)
        if not topic:
            return query
        # Prefer substituting the anaphora in place; otherwise append the topic.
        substituted = _ANAPHORA_RE.sub(topic, query)
        if substituted.lower() != query.lower():
            return substituted
        return f"{query} {topic}".strip()

    @staticmethod
    def _topic_terms(text: str) -> list[str]:
        return [
            word
            for word in _TOKEN.findall(text.lower())
            if word not in _INSTRUCTION and len(word) > 2
        ]

    def _is_followup(self, query: str) -> bool:
        words = _TOKEN.findall(query.lower())
        has_anaphora = any(word in _ANAPHORA for word in words)
        has_own_topic = bool(self._topic_terms(query))
        short_cue = len(words) <= 5 and bool(_FOLLOWUP_CUES.search(query))
        # A follow-up either points back (anaphora), has no topic of its own, or
        # is a short continuation cue ("tell me more", "why?").
        return has_anaphora or not has_own_topic or short_cue

    def _prior_topic(self, history: list[dict]) -> str:
        # Anchor on the most recent user turn that *introduced* a topic — i.e. a
        # standalone question, not itself a follow-up. This walks past turns like
        # "why does it matter?" back to "explain cohorts", so the topic stays
        # "cohorts" rather than the weak word "matter".
        for turn in reversed(history):
            if turn.get("role") != "user":
                continue
            content = turn.get("content", "")
            if self._is_followup(content):
                continue
            terms = self._topic_terms(content)
            if terms:
                return " ".join(terms)
        # Fallback: if every prior turn looks like a follow-up, use the most
        # recent user turn that has any topic words at all.
        for turn in reversed(history):
            if turn.get("role") != "user":
                continue
            terms = self._topic_terms(turn.get("content", ""))
            if terms:
                return " ".join(terms)
        return ""
