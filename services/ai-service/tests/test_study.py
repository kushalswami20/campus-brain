import base64

from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())

MATERIAL = """Operating Systems: Deadlocks and Scheduling

A deadlock occurs when processes wait on each other in a cycle. The four Coffman
conditions are mutual exclusion, hold and wait, no preemption, and circular wait.

Round Robin is a preemptive scheduling algorithm that assigns a fixed time quantum
to each process. The Banker algorithm avoids deadlock by checking safe states.

Semaphores are synchronization primitives used to control access to shared resources.
A mutex is a binary semaphore that enforces mutual exclusion between threads.
"""


def _ingest() -> None:
    client.post(
        "/v1/ingest",
        json={
            "request_id": "s-ing",
            "document_id": "os-doc",
            "filename": "os_notes.txt",
            "mime_type": "text/plain",
            "content_base64": base64.b64encode(MATERIAL.encode()).decode(),
        },
    )


def test_summary_is_grounded_with_key_points() -> None:
    _ingest()
    res = client.post(
        "/v1/study/summary",
        json={"request_id": "r1", "user_id": "u1", "topic": "deadlocks"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["grounded"] is True
    assert len(body["key_points"]) >= 1
    assert body["citations"]


def test_flashcards_generated_from_material() -> None:
    _ingest()
    res = client.post(
        "/v1/study/flashcards",
        json={"request_id": "r2", "user_id": "u1", "topic": "scheduling", "count": 5},
    )
    assert res.status_code == 200
    body = res.json()
    assert 1 <= len(body["flashcards"]) <= 5
    for card in body["flashcards"]:
        assert card["question"]
        assert card["answer"]


def test_quiz_questions_have_valid_answer_index() -> None:
    _ingest()
    res = client.post(
        "/v1/study/quiz",
        json={"request_id": "r3", "user_id": "u1", "topic": "deadlock", "count": 3},
    )
    assert res.status_code == 200
    body = res.json()
    for question in body["questions"]:
        assert len(question["options"]) == 4
        assert 0 <= question["answer_index"] < 4
        # The correct option is the answer at answer_index.
        assert question["options"][question["answer_index"]]


def test_summary_refuses_without_material() -> None:
    res = client.post(
        "/v1/study/summary",
        json={"request_id": "r4", "user_id": "u1", "topic": "quantum chromodynamics"},
    )
    assert res.status_code == 200
    assert res.json()["grounded"] is False
