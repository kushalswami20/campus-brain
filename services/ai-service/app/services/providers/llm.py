"""LLM providers behind a single Protocol.

``FakeLLM`` is CampusBrain's **own** answer engine: a dependency-free extractive
summariser. It does not call any external model — it selects and ranks the most
salient sentences from the retrieved context and formats them, so every answer
is grounded by construction (each sentence is verbatim from the sources) and the
whole agent pipeline runs with no API key. ``OpenAILLM`` is an optional drop-in
that synthesises fluent prose when a key is configured; both take the same
(query, context) inputs so the answer-generator agent is agnostic to which runs.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

# ── Tuning knobs (safe to adjust) ───────────────────────────────────────────
# Default number of sentences returned (a normal-length answer).
MAX_BULLETS = 7
# Length when the user asks to keep it short ("brief", "tl;dr", …).
BRIEF_BULLETS = 3
# Length when the user asks for depth ("in detail", "long", "everything", …).
DETAILED_BULLETS = 14
# Sentences shorter than this (in words) are treated as fragments and dropped.
MIN_SENTENCE_WORDS = 6
# How strongly a sentence is favoured for containing the user's query words.
QUERY_BOOST = 2.0
# Two sentences sharing more than this fraction of content words are duplicates.
DEDUPE_OVERLAP = 0.7
# ────────────────────────────────────────────────────────────────────────────

# Instruction cues in the query that shape the *response*, not the topic.
_WANT_MORE = re.compile(
    r"\b(in )?(full |complete |great |more )?"
    r"(detail|detailed|depth|thorough|comprehensive|elaborate|elaborately|"
    r"long|lengthy|everything|expand|in full|deep[- ]?dive)\b"
)
_WANT_LESS = re.compile(
    r"\b(brief|briefly|short|shortly|concise|concisely|tl;?dr|quick|quickly|"
    r"one[- ]?line|nutshell|gist|key points?)\b"
)
_WANT_PARAGRAPH = re.compile(
    r"\b(paragraph|prose|essay|narrative|write[- ]?up|as text|in words|"
    r"in sentences|continuous)\b"
)
# Words that describe HOW to answer — stripped before topic scoring so
# "explain cohorts in detail" ranks on "cohorts", not "detail".
_INSTRUCTION_STOP = {
    "explain", "describe", "detail", "detailed", "detailing", "depth",
    "thorough", "comprehensive", "elaborate", "full", "complete", "long",
    "lengthy", "brief", "briefly", "short", "concise", "quick", "summary",
    "summarise", "summarize", "overview", "paragraph", "prose", "essay",
    "narrative", "point", "points", "bullet", "bullets", "list", "tell",
    "give", "note", "notes", "please", "kindly", "everything", "gist",
    "nutshell", "expand", "define", "definition", "meaning", "understand",
}
# ────────────────────────────────────────────────────────────────────────────

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9•])")
_LEADING_CITATION = re.compile(r"^\s*\[(\d+)\]\s*")
_TOKEN_RE = re.compile(r"[a-z0-9]+")
_STOP = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "of", "to", "in", "on", "at", "by", "for", "with", "and", "or", "but",
    "if", "then", "so", "as", "it", "its", "this", "that", "these", "those",
    "we", "you", "they", "he", "she", "i", "our", "your", "their", "not",
    "can", "will", "would", "should", "may", "must", "do", "does", "did",
    "from", "into", "up", "out", "per", "one", "each", "every", "all", "any",
}


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
    "context, formatted as concise Markdown (a one-line lead-in, then bullet "
    "points). Cite sources as [n]. If the context does not contain the answer, "
    "say you don't have that information. Never invent facts."
)


@dataclass
class _Sentence:
    text: str
    source: int  # the [n] passage this sentence came from
    terms: set[str]
    score: float = 0.0


def _content_terms(text: str) -> set[str]:
    return {
        tok
        for tok in _TOKEN_RE.findall(text.lower())
        if tok not in _STOP and len(tok) > 2
    }


@dataclass
class _Intent:
    """What the query asks for, beyond its topic."""

    limit: int  # how many sentences to return
    paragraph: bool  # render as prose instead of bullets
    topic_terms: set[str]  # query terms with instruction words removed
    topic: str  # cleaned topic text for the lead-in


def _parse_intent(query: str) -> _Intent:
    q = query.strip()
    low = q.lower()

    if _WANT_MORE.search(low):
        limit = DETAILED_BULLETS
    elif _WANT_LESS.search(low):
        limit = BRIEF_BULLETS
    else:
        limit = MAX_BULLETS

    paragraph = bool(_WANT_PARAGRAPH.search(low))

    topic_terms = {t for t in _content_terms(q) if t not in _INSTRUCTION_STOP}
    # Rebuild a readable topic from the surviving words (fallback to raw query).
    kept = [
        w
        for w in re.findall(r"[A-Za-z0-9]+", q)
        if w.lower() not in _INSTRUCTION_STOP and w.lower() not in _STOP
    ]
    topic = " ".join(kept) if kept else q.rstrip("?.").strip()
    return _Intent(
        limit=limit,
        paragraph=paragraph,
        topic_terms=topic_terms,
        topic=topic,
    )


class FakeLLM:
    """Extractive summariser — ranks and formats the most salient context.

    Pipeline: split the numbered context into sentences (remembering each one's
    source passage), drop fragments, score by term-salience + query relevance,
    remove near-duplicates, then render the top sentences as a Markdown bullet
    list with per-bullet [n] citations. Grounded by construction, so the
    verification agent's support check stays high.
    """

    model = "extractive-v2"

    def generate(self, *, query: str, context: str) -> LLMResult:
        sentences = self._parse(context)
        if not sentences:
            return LLMResult(
                text=(
                    "I don't have information on that in your uploaded material "
                    "yet."
                ),
                model=self.model,
            )

        intent = _parse_intent(query)
        self._score(sentences, intent.topic_terms)
        chosen = self._select(sentences, intent.limit)
        text = self._format(chosen, intent)
        return LLMResult(
            text=text,
            prompt_tokens=len(context) // 4,
            completion_tokens=len(text) // 4,
            model=self.model,
        )

    # -- steps ----------------------------------------------------------------

    def _parse(self, context: str) -> list[_Sentence]:
        """Split numbered passages into clean, source-tagged sentences."""
        out: list[_Sentence] = []
        for block in context.split("\n\n"):
            block = block.strip()
            if not block:
                continue
            match = _LEADING_CITATION.match(block)
            source = int(match.group(1)) if match else 1
            body = _LEADING_CITATION.sub("", block)
            for raw in _SENT_SPLIT.split(body):
                sentence = " ".join(raw.split()).strip(" •-–—")
                if len(sentence.split()) < MIN_SENTENCE_WORDS:
                    continue  # fragment / heading noise
                terms = _content_terms(sentence)
                if not terms:
                    continue
                out.append(_Sentence(text=sentence, source=source, terms=terms))
        return out

    def _score(self, sentences: list[_Sentence], topic_terms: set[str]) -> None:
        """Salience (corpus term frequency) + a boost for topic relevance."""
        freq: Counter[str] = Counter()
        for s in sentences:
            freq.update(s.terms)
        for s in sentences:
            salience = sum(freq[t] for t in s.terms) / len(s.terms)
            overlap = len(s.terms & topic_terms)
            s.score = salience + QUERY_BOOST * overlap

    def _select(self, sentences: list[_Sentence], limit: int) -> list[_Sentence]:
        """Take the highest-scoring, non-duplicate sentences (order preserved)."""
        ranked = sorted(sentences, key=lambda s: s.score, reverse=True)
        picked: list[_Sentence] = []
        for cand in ranked:
            if len(picked) >= limit:
                break
            if any(self._duplicate(cand.terms, p.terms) for p in picked):
                continue
            picked.append(cand)
        # Restore reading order (by original position) for a coherent summary.
        order = {id(s): i for i, s in enumerate(sentences)}
        picked.sort(key=lambda s: order[id(s)])
        return picked

    @staticmethod
    def _duplicate(a: set[str], b: set[str]) -> bool:
        if not a or not b:
            return False
        return len(a & b) / min(len(a), len(b)) > DEDUPE_OVERLAP

    @staticmethod
    def _format(chosen: list[_Sentence], intent: _Intent) -> str:
        topic = intent.topic.strip()
        if topic:
            lead = f"Here's what your material says about **{topic}**:"
        else:
            lead = "Here are the key points from your material:"

        if intent.paragraph:
            # Flowing prose: each sentence keeps its inline [n] citation so the
            # paragraph stays grounded and attributable.
            body = " ".join(f"{s.text} [{s.source}]" for s in chosen)
        else:
            body = "\n".join(f"- {s.text} [{s.source}]" for s in chosen)
        return f"{lead}\n\n{body}"


class OpenAILLM:
    """Optional real generation via the OpenAI Chat Completions API."""

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
