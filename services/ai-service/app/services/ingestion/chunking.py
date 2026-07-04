"""Chunking: recursive splitting with paragraph-aware (semantic-ish) boundaries.

Splits on the largest natural boundary that keeps a chunk under the target size
(paragraphs → sentences → words), preserving overlap so context isn't lost at
the seams. Token counts use a ~4-chars-per-token heuristic (good enough for
budgeting; the real tokenizer is swapped in when the LLM path is active).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_PARAGRAPH_RE = re.compile(r"\n\s*\n")
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


@dataclass
class Chunk:
    index: int
    content: str
    token_count: int


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def chunk_text(
    text: str, *, target_tokens: int = 400, overlap_tokens: int = 60
) -> list[Chunk]:
    text = text.strip()
    if not text:
        return []

    target_chars = target_tokens * 4
    overlap_chars = overlap_tokens * 4

    segments = _split_recursive(text, target_chars)
    chunks: list[Chunk] = []
    buffer = ""

    for segment in segments:
        if buffer and len(buffer) + len(segment) + 1 > target_chars:
            chunks.append(_make_chunk(len(chunks), buffer))
            buffer = _tail(buffer, overlap_chars) + " " + segment
        else:
            buffer = f"{buffer} {segment}".strip() if buffer else segment

    if buffer.strip():
        chunks.append(_make_chunk(len(chunks), buffer))
    return chunks


def _split_recursive(text: str, target_chars: int) -> list[str]:
    """Break text into segments no larger than target, on natural boundaries."""
    if len(text) <= target_chars:
        return [text]

    paragraphs = _PARAGRAPH_RE.split(text)
    if len(paragraphs) > 1:
        out: list[str] = []
        for paragraph in paragraphs:
            out.extend(_split_recursive(paragraph.strip(), target_chars))
        return [segment for segment in out if segment]

    sentences = _SENTENCE_RE.split(text)
    if len(sentences) > 1:
        out = []
        for sentence in sentences:
            if len(sentence) > target_chars:
                out.extend(_split_words(sentence, target_chars))
            else:
                out.append(sentence.strip())
        return [segment for segment in out if segment]

    return _split_words(text, target_chars)


def _split_words(text: str, target_chars: int) -> list[str]:
    words = text.split()
    segments: list[str] = []
    current = ""
    for word in words:
        if current and len(current) + len(word) + 1 > target_chars:
            segments.append(current)
            current = word
        else:
            current = f"{current} {word}".strip()
    if current:
        segments.append(current)
    return segments


def _tail(text: str, overlap_chars: int) -> str:
    if overlap_chars <= 0 or len(text) <= overlap_chars:
        return text
    return text[-overlap_chars:]


def _make_chunk(index: int, content: str) -> Chunk:
    trimmed = content.strip()
    return Chunk(index=index, content=trimmed, token_count=estimate_tokens(trimmed))
