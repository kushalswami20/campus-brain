import base64

from fastapi.testclient import TestClient

from app.main import create_app
from app.services.ingestion.chunking import chunk_text

client = TestClient(create_app())

NOTES = """# Hashing and Hash Tables

A hash table maps keys to values using a hash function. Collisions are resolved
by chaining or open addressing. The average-case lookup is O(1).

Unit 3 covers collision resolution strategies in detail, including linear
probing, quadratic probing, and double hashing. Load factor affects performance.
"""


def _b64(text: str) -> str:
    return base64.b64encode(text.encode()).decode()


def test_chunking_splits_and_counts() -> None:
    chunks = chunk_text("word " * 500, target_tokens=100, overlap_tokens=10)
    assert len(chunks) > 1
    assert all(chunk.token_count > 0 for chunk in chunks)
    assert [c.index for c in chunks] == list(range(len(chunks)))


def test_ingest_indexes_document_and_detects_metadata() -> None:
    res = client.post(
        "/v1/ingest",
        json={
            "request_id": "ing-1",
            "document_id": "doc-hash",
            "filename": "DSA_unit3_notes_2023.txt",
            "mime_type": "text/plain",
            "content_base64": _b64(NOTES),
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["chunk_count"] >= 1
    assert body["detected_metadata"]["year"] == 2023
    assert body["detected_metadata"]["unit"] == "Unit 3"
    assert body["detected_metadata"]["document_type"] == "NOTES"
    assert body["chunks"][0]["vector_id"] == "doc-hash:0"


def test_ingest_then_query_returns_grounded_answer_with_citations() -> None:
    ingest = client.post(
        "/v1/ingest",
        json={
            "request_id": "ing-2",
            "document_id": "doc-hash",
            "filename": "hashing_notes.txt",
            "mime_type": "text/plain",
            "content_base64": _b64(NOTES),
        },
    )
    assert ingest.status_code == 200

    answer = client.post(
        "/v1/rag/query/sync",
        json={
            "request_id": "q-1",
            "user_id": "u1",
            "query": "How are hash table collisions resolved?",
        },
    )
    assert answer.status_code == 200
    body = answer.json()
    assert body["grounded"] is True
    assert len(body["citations"]) >= 1
    assert body["citations"][0]["document_id"] == "doc-hash"
    assert "collision" in body["answer"].lower() or "hash" in body["answer"].lower()


def test_ingest_rejects_unsupported_media_type() -> None:
    res = client.post(
        "/v1/ingest",
        json={
            "request_id": "ing-3",
            "document_id": "doc-x",
            "filename": "archive.zip",
            "mime_type": "application/zip",
            "content_base64": _b64("binary"),
        },
    )
    assert res.status_code == 415
    assert res.json()["error"]["code"] == "AI_UNSUPPORTED_MEDIA"
