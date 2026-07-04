"""Heuristic metadata extraction: year, unit, topic, document type.

Fast, dependency-free signals derived from the filename and text. When the LLM
path is active (keys present) this is augmented by a structured-extraction call;
the heuristics remain as a cheap, always-available baseline.
"""

from __future__ import annotations

import re

_YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
_UNIT_RE = re.compile(r"\bunit[\s\-_]?(\d{1,2})\b", re.IGNORECASE)
_SEM_RE = re.compile(r"\bsem(?:ester)?[\s\-_]?(\d{1,2})\b", re.IGNORECASE)

_TYPE_HINTS: dict[str, str] = {
    "pyq": "PYQ",
    "previous year": "PYQ",
    "question paper": "PYQ",
    "syllabus": "SYLLABUS",
    "assignment": "ASSIGNMENT",
    "notes": "NOTES",
    "slides": "SLIDES",
    "lecture": "SLIDES",
}


def extract_metadata(
    *, filename: str, text: str, provided_type: str | None
) -> dict:
    # Underscores/hyphens are word characters, which defeat \b boundaries in the
    # patterns below (e.g. "notes_2023"). Normalise separators to spaces first.
    normalized_name = re.sub(r"[_\-]+", " ", filename)
    haystack = f"{normalized_name}\n{text[:2000]}".lower()

    metadata: dict = {}

    year = _YEAR_RE.search(normalized_name) or _YEAR_RE.search(text[:1000])
    if year:
        metadata["year"] = int(year.group(0))

    unit = _UNIT_RE.search(haystack)
    if unit:
        metadata["unit"] = f"Unit {int(unit.group(1))}"

    semester = _SEM_RE.search(haystack)
    if semester:
        metadata["semester"] = int(semester.group(1))

    metadata["document_type"] = provided_type or _detect_type(haystack)

    topic = _guess_topic(text)
    if topic:
        metadata["topic"] = topic

    return metadata


def _detect_type(haystack: str) -> str:
    for hint, doc_type in _TYPE_HINTS.items():
        if hint in haystack:
            return doc_type
    return "OTHER"


def _guess_topic(text: str) -> str | None:
    """Use the first substantive line as a coarse topic label."""
    for line in text.splitlines():
        stripped = line.strip().lstrip("#").strip()
        if 3 <= len(stripped) <= 80 and any(c.isalpha() for c in stripped):
            return stripped
    return None
