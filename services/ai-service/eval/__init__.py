"""Offline evaluation harness for the RAG pipeline.

Runs a labelled golden set against the multi-agent pipeline and reports
retrieval quality (recall@k, MRR) and answer-decision quality (grounding on
in-scope questions, refusal on out-of-scope ones). See ``eval/run.py``.
"""
