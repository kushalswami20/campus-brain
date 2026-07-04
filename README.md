# CampusBrain

An intelligent academic assistant for university students. Upload course material —
PDFs, DOCX, PPTs, previous-year papers, notes, images — and get grounded, cited answers
via an advanced multi-agent Retrieval-Augmented Generation (RAG) pipeline.

> **Status:** Milestone 0 — foundation & architecture. See [docs/MILESTONES.md](docs/MILESTONES.md).

## Monorepo layout

```
CampusBrain/
├── apps/
│   ├── web/                 # Next.js 15 (React 19) frontend
│   └── api/                 # NestJS backend (auth, business logic, orchestration)
├── services/
│   └── ai-service/          # Python FastAPI + LangGraph AI microservice (RAG)
├── packages/
│   └── shared-types/        # Shared TS types/contracts (web ⇄ api)
├── infra/
│   └── docker/              # Dockerfiles, compose, deployment config
├── docs/                    # Architecture, ER/sequence diagrams, guides
└── .github/workflows/       # CI/CD pipelines
```

## Architecture at a glance

Three tiers with strict boundaries:

1. **Web (Next.js)** — talks only to the NestJS API.
2. **API (NestJS)** — auth, authorization, uploads, persistence, caching, analytics,
   and orchestration. **Never** calls OpenAI or holds AI logic. Talks to Postgres,
   Redis, and the AI service.
3. **AI Service (FastAPI)** — the only tier that touches the LLM, embeddings, and the
   vector store. Owns the entire RAG/agent pipeline.

```
┌──────────┐    REST     ┌──────────┐   REST/stream   ┌───────────────┐
│  Next.js │ ──────────▶ │  NestJS  │ ──────────────▶ │  FastAPI AI   │
│   (web)  │ ◀────────── │  (api)   │ ◀────────────── │  (RAG/agents) │
└──────────┘             └────┬─────┘                 └───────┬───────┘
                              │                               │
                     ┌────────┴────────┐              ┌───────┴────────┐
                     │ Postgres · Redis│              │ Pinecone · LLM │
                     └─────────────────┘              └────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Tech stack

| Tier | Stack |
|------|-------|
| Web | Next.js 15, React 19, TypeScript, Tailwind, shadcn/ui, Framer Motion, TanStack Query, Zustand, RHF + Zod, Clerk |
| API | NestJS, Prisma, PostgreSQL, Redis, BullMQ, JWT/Passport, Swagger, WebSockets, Cloudinary |
| AI | FastAPI, LangGraph, LangChain, OpenAI, Pinecone, Sentence-Transformers, BM25, Cross-Encoder rerank, PyMuPDF, OCR |

## Getting started

Prerequisites and per-service setup land incrementally per milestone. Local dev will run
on Docker Compose (Postgres, Redis, all three services). See
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) once Milestone 1 is complete.
