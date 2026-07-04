# ADR-0001: Three-tier architecture with a dedicated AI microservice

- **Status:** Accepted
- **Date:** 2026-07-04

## Context

CampusBrain needs a premium product surface (Next.js), robust application/business logic with
strong relational data (auth, chats, documents, analytics), and an advanced RAG/agent pipeline
that lives in the Python AI ecosystem (LangGraph, LangChain, Sentence-Transformers, PyMuPDF).
Mixing these concerns in one service would couple deployment, scaling, and language ecosystems.

## Decision

Split into three tiers with strict, REST-contract boundaries:

1. **Web (Next.js)** — talks only to the API.
2. **API (NestJS)** — owns auth, business logic, all relational persistence, caching, jobs,
   analytics, and orchestration of the AI service. Contains **no** AI/LLM logic.
3. **AI Service (FastAPI)** — the only tier with LLM, embedding, and vector-store access.

## Consequences

**Positive**
- Independent scaling: the AI tier (GPU/CPU-heavy, bursty) scales separately from the product API.
- Language fit: Python for the mature AI tooling; Node/TS for the product surface and DX.
- Blast-radius isolation: AI provider/model changes never touch auth or persistence code.
- Clear security boundary: LLM keys live only in the AI tier; user auth lives only in the API.

**Negative / trade-offs**
- Network hop between API and AI adds latency and failure modes → mitigated with timeouts,
  retries, health checks, and streaming.
- A shared contract must be maintained across languages → versioned `/v1` OpenAPI on both sides
  and a common error envelope with `requestId` tracing.

## Alternatives considered

- **Single Next.js app with API routes calling OpenAI directly** — fastest to build, but
  violates separation of concerns, leaks LLM keys to the edge, and can't scale the AI workload
  independently. Rejected.
- **NestJS calling OpenAI directly (no Python tier)** — loses the Python RAG ecosystem and
  forces reimplementation of retrieval/reranking tooling in Node. Rejected.
