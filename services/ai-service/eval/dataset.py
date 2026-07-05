"""Golden evaluation set: a small labelled corpus and the questions asked of it.

Kept deterministic and self-contained (no external files) so the harness runs
anywhere. Add cases here as you find weaknesses — each new failing question you
discover in the app becomes a permanent regression check.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

# ── Corpus: document_id → ordered chunks ─────────────────────────────────────
CORPUS: dict[str, list[str]] = {
    "algorithms": [
        "Dijkstra's algorithm finds single-source shortest paths on a weighted "
        "graph using a priority queue to always expand the nearest unvisited node.",
        "Kruskal's algorithm builds a minimum spanning tree by adding the "
        "cheapest edge that does not form a cycle, using a union-find structure.",
        "Binary search locates a target in a sorted array in O(log n) time by "
        "repeatedly halving the search interval.",
        "Quicksort partitions an array around a pivot and recursively sorts the "
        "partitions, averaging O(n log n) time.",
    ],
    "networking": [
        "TCP provides reliable, ordered byte-stream delivery and establishes a "
        "connection with a three-way handshake: SYN, SYN-ACK, ACK.",
        "UDP is a connectionless transport protocol with no handshake or delivery "
        "guarantees, favouring low latency over reliability.",
        "DNS resolves human-readable domain names into IP addresses through a "
        "hierarchy of authoritative name servers.",
    ],
    "dbms": [
        "A B-tree index keeps keys sorted in a balanced multi-way tree so lookups, "
        "range scans, and inserts all run in logarithmic time.",
        "ACID transactions guarantee atomicity, consistency, isolation, and "
        "durability so a database stays correct despite failures or concurrency.",
        "Normalization organizes relational tables to remove redundancy, "
        "typically progressing through first, second, and third normal form.",
    ],
    "os": [
        "Paging maps virtual addresses to physical frames in fixed-size pages, "
        "letting a process use more memory than is physically contiguous.",
        "A deadlock occurs when processes each hold a resource and wait for one "
        "another in a cycle, so none can proceed.",
        "Round-robin scheduling gives each ready process a fixed time slice in "
        "turn, providing fair CPU sharing.",
    ],
}


class Kind(str, Enum):
    IN_SCOPE = "in_scope"  # should answer, from a known document
    OUT_OF_SCOPE = "out_of_scope"  # should refuse
    BROAD = "broad"  # whole-corpus summary; should answer


@dataclass(frozen=True)
class Case:
    query: str
    kind: Kind
    # For in-scope cases: the document(s) that should back the answer.
    expected_docs: tuple[str, ...] = field(default_factory=tuple)


CASES: list[Case] = [
    # In-scope — literal phrasing.
    Case("How does Dijkstra's algorithm work?", Kind.IN_SCOPE, ("algorithms",)),
    Case("What is the TCP three-way handshake?", Kind.IN_SCOPE, ("networking",)),
    Case("Explain ACID transactions.", Kind.IN_SCOPE, ("dbms",)),
    Case("What is a B-tree index?", Kind.IN_SCOPE, ("dbms",)),
    Case("How does paging work?", Kind.IN_SCOPE, ("os",)),
    # In-scope — paraphrased (no shared keywords → tests semantic retrieval).
    Case("How are the shortest routes between nodes computed?",
         Kind.IN_SCOPE, ("algorithms",)),
    Case("How do two machines set up a reliable connection?",
         Kind.IN_SCOPE, ("networking",)),
    Case("What keeps a database correct when things fail?",
         Kind.IN_SCOPE, ("dbms",)),
    Case("Why can a program use more memory than is physically contiguous?",
         Kind.IN_SCOPE, ("os",)),
    Case("What structure avoids cycles when building a spanning tree?",
         Kind.IN_SCOPE, ("algorithms",)),
    # Out-of-scope — must refuse.
    Case("Who won the 2022 FIFA World Cup?", Kind.OUT_OF_SCOPE),
    Case("What is the capital of France?", Kind.OUT_OF_SCOPE),
    Case("Give me a recipe for chocolate cake.", Kind.OUT_OF_SCOPE),
    Case("What's the weather tomorrow?", Kind.OUT_OF_SCOPE),
    # Broad — whole-corpus summary; must answer (gate bypass).
    Case("Summarise the key topics in my notes.", Kind.BROAD),
    Case("Give me an overview of this material.", Kind.BROAD),
    Case("What are the most important concepts here?", Kind.BROAD),
]
