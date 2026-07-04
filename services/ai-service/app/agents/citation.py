"""Citation agent — source attribution.

Turns the passages that actually fed the answer (the reranked/selected set) into
structured citations the client renders as [n] references. Only emitted when the
answer is grounded, so citations never point at unused sources.
"""

from __future__ import annotations

from .state import RagState


class CitationAgent:
    name = "citation"

    def __call__(self, state: RagState) -> RagState:
        if not state.get("grounded", False):
            return {
                "citations": [],
                "trace": [*state.get("trace", []), self.name],
            }

        citations = []
        for item in state.get("reranked", []):
            meta = item.get("metadata", {})
            citations.append(
                {
                    "vector_id": item["vector_id"],
                    "document_id": item["document_id"],
                    "chunk_index": item["chunk_index"],
                    "content": item["content"],
                    "page_number": meta.get("page_number"),
                    "score": item["score"],
                    "title": meta.get("topic") or item["document_id"],
                }
            )
        return {
            "citations": citations,
            "trace": [*state.get("trace", []), self.name],
        }
