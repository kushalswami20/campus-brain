import json

from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())


def _parse_sse(raw: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for block in raw.strip().split("\n\n"):
        if not block.strip():
            continue
        event_type = ""
        data = "{}"
        for line in block.splitlines():
            if line.startswith("event: "):
                event_type = line[len("event: ") :]
            elif line.startswith("data: "):
                data = line[len("data: ") :]
        events.append((event_type, json.loads(data)))
    return events


def test_sync_query_refuses_without_context() -> None:
    res = client.post(
        "/v1/rag/query/sync",
        json={"request_id": "req-1", "user_id": "u1", "query": "What is a B-tree?"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["grounded"] is False
    assert body["citations"] == []
    assert "uploaded course material" in body["answer"]


def test_streaming_query_emits_ordered_events() -> None:
    res = client.post(
        "/v1/rag/query",
        json={"request_id": "req-2", "user_id": "u1", "query": "Explain hashing"},
    )
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    assert res.headers["x-request-id"] == "req-2"

    events = _parse_sse(res.text)
    types = [t for t, _ in events]
    assert "token" in types
    # Ordering guarantee: citations, usage, then done, in that order at the tail.
    assert types[-3:] == ["citations", "usage", "done"]


def test_validation_rejects_empty_query() -> None:
    res = client.post(
        "/v1/rag/query/sync",
        json={"request_id": "req-3", "user_id": "u1", "query": ""},
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "AI_VALIDATION_ERROR"
