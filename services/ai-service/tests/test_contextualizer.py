"""Tests for the conversational contextualizer agent."""

from __future__ import annotations

from app.agents.contextualizer import ContextualizerAgent


def _run(query: str, history: list[dict]) -> dict:
    return ContextualizerAgent()({"query": query, "history": history, "trace": []})


def test_anaphora_is_replaced_with_prior_topic() -> None:
    history = [{"role": "user", "content": "explain cohorts"}]
    out = _run("explain that in more detail", history)
    assert out["query"] == "explain cohorts in more detail"
    assert out["original_query"] == "explain that in more detail"


def test_topicless_followup_appends_prior_topic() -> None:
    history = [{"role": "user", "content": "what is a cohort?"}]
    out = _run("why?", history)
    assert "cohort" in out["query"].lower()
    assert out["query"] != "why?"


def test_standalone_question_is_left_unchanged() -> None:
    history = [{"role": "user", "content": "explain cohorts"}]
    out = _run("what does eligibility mean?", history)
    assert out["query"] == "what does eligibility mean?"


def test_no_history_is_passthrough() -> None:
    out = _run("explain that", [])
    assert out["query"] == "explain that"


def test_walks_back_to_last_user_turn_with_a_topic() -> None:
    history = [
        {"role": "user", "content": "explain cascade levels"},
        {"role": "assistant", "content": "Levels L1..Ln are ..."},
        {"role": "user", "content": "ok"},  # topicless, should be skipped
    ]
    out = _run("tell me more about them", history)
    assert "cascade" in out["query"].lower() or "levels" in out["query"].lower()
