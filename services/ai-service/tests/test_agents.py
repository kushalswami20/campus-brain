"""Direct tests of the multi-agent pipeline (no HTTP layer)."""

from __future__ import annotations

from app.agents.graph import RagPipeline
from app.services.providers.embeddings import FakeEmbeddingProvider
from app.services.providers.keyword_index import InMemoryBM25Index
from app.services.providers.llm import FakeLLM
from app.services.providers.vector_store import InMemoryVectorStore, VectorRecord

EXPECTED_AGENTS = {
    "planner",
    "retriever",
    "hybrid_search",
    "reranker",
    "reasoning",
    "answer_generator",
    "verification",
    "citation",
    "reflection",
}


def _seed() -> RagPipeline:
    embeddings = FakeEmbeddingProvider()
    store = InMemoryVectorStore()
    keywords = InMemoryBM25Index()

    chunks = {
        "doc1:0": "Dijkstra's algorithm finds shortest paths using a priority queue.",
        "doc1:1": "Kruskal's algorithm builds a minimum spanning tree via union-find.",
        "doc2:0": "TCP provides reliable ordered delivery with a three-way handshake.",
    }
    for vid, text in chunks.items():
        doc_id = vid.split(":")[0]
        meta = {"document_id": doc_id, "chunk_index": int(vid.split(":")[1]),
                "content": text, "topic": doc_id}
        store.upsert([VectorRecord(vid, embeddings.embed_one(text), meta)])
        keywords.add(vid, text, meta)

    return RagPipeline(
        embeddings=embeddings,
        vector_store=store,
        keyword_index=keywords,
        llm=FakeLLM(),
    )


def test_pipeline_runs_all_agents_and_grounds_answer() -> None:
    pipeline = _seed()
    result = pipeline.run(
        request_id="r1",
        query="How does Dijkstra's algorithm work?",
        filters=None,
        top_k=5,
    )
    assert result.grounded is True
    assert result.citations
    assert result.citations[0]["document_id"] == "doc1"
    # Every agent in the graph must have executed at least once.
    assert EXPECTED_AGENTS.issubset(set(result.trace))
    assert "dijkstra" in result.answer.lower()


def test_hybrid_search_finds_exact_term_match() -> None:
    pipeline = _seed()
    # "union-find" is a distinctive term BM25 should surface even if the dense
    # fake embedding is lukewarm.
    result = pipeline.run(
        request_id="r2",
        query="union-find minimum spanning tree",
        filters=None,
        top_k=5,
    )
    assert result.grounded is True
    assert any(c["document_id"] == "doc1" for c in result.citations)


def test_metadata_filter_scopes_retrieval() -> None:
    pipeline = _seed()
    result = pipeline.run(
        request_id="r3",
        query="reliable delivery handshake",
        filters={"document_id": "doc2"},
        top_k=5,
    )
    # Only doc2 chunks are eligible under the filter.
    assert all(c["document_id"] == "doc2" for c in result.citations)
