from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())


def test_liveness() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "campusbrain-ai"


def test_readiness_reports_provider_state() -> None:
    res = client.get("/health/ready")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "openai" in body["checks"]
    assert "pinecone" in body["checks"]
