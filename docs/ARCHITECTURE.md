# CampusBrain — Architecture

## 1. Principles

- **Strict tier boundaries.** The web tier never talks to the AI service or the database.
  The API tier never embeds AI logic or calls the LLM. The AI tier never touches the
  application database or auth. Each boundary is a REST contract.
- **Clean Architecture in the API.** Controllers → Services (use-cases) → Repositories →
  Prisma. DTOs at the edges; domain logic has no framework leakage.
- **The AI service is stateless per request** for inference; all durable state (chats,
  messages, documents, metadata) lives in Postgres owned by the API. The AI service owns
  only vector state in Pinecone and ephemeral cache in Redis.
- **Fail loud, degrade gracefully.** Every cross-service call has timeouts, retries with
  backoff, and typed error propagation. Health checks gate traffic.

## 2. Tiers & responsibilities

### Web — Next.js 15 / React 19
Rendering, auth UX (Clerk), data fetching (TanStack Query), client state (Zustand), forms
(RHF + Zod), streaming chat rendering. Talks **only** to the NestJS API.

### API — NestJS
Authentication & authorization (JWT + refresh, RBAC), file uploads (Multer → Cloudinary),
business logic, all database reads/writes (Prisma/Postgres), caching (Redis), background jobs
(BullMQ), analytics, chat history, notifications, REST + Swagger, WebSockets for live status.
Orchestrates the AI service. **Never** calls OpenAI or contains RAG logic.

### AI Service — FastAPI
The only tier with LLM/embedding/vector access. Ingestion (OCR, chunking, embeddings, metadata
extraction, Pinecone upsert) and the LangGraph multi-agent RAG pipeline. Exposes typed REST
endpoints with streaming.

## 3. Request flows

### 3.1 Chat (streaming)
```
Web ──POST /chats/:id/messages──▶ API
                                   ├─ authz, persist user message, load chat context
                                   └─ POST /rag/query (stream) ──▶ AI Service
                                                                    ├─ LangGraph pipeline
                                                                    └─ SSE tokens ──▶ API ──SSE──▶ Web
                                   API persists final answer + citations + usage
```

### 3.2 Ingestion (async)
```
Web ──POST /documents (multipart)──▶ API ── upload to Cloudinary, create Document(status=QUEUED)
                                          └─ enqueue BullMQ ingest job
BullMQ worker ── POST /ingest ──▶ AI Service ── OCR→clean→chunk→embed→extract meta→Pinecone upsert
              ◀── chunk/metadata summary ──   API writes EmbeddingMetadata, status=READY
                                              WebSocket push: document ready
```

## 4. Cross-service contract

Shared request/response shapes live in `packages/shared-types` for web⇄api. The api⇄ai
contract is versioned under `/v1` and documented via OpenAPI on both sides. Errors use a
common envelope:

```jsonc
{ "error": { "code": "AI_TIMEOUT", "message": "...", "requestId": "..." } }
```

Every request carries a `requestId` (generated at the API edge) propagated to the AI service
and into logs for end-to-end tracing.

## 5. Data ownership

| Store | Owner | Holds |
|-------|-------|-------|
| PostgreSQL | API | Users, auth, chats, messages, documents, metadata, analytics, everything relational |
| Redis | API + AI | API: cache, BullMQ queues. AI: retrieval/embedding cache |
| Pinecone | AI | Document chunk vectors + metadata for filtering |
| Cloudinary | API | Raw uploaded files |

## 6. Observability

Structured JSON logs (pino in NestJS, structlog in FastAPI) keyed by `requestId`, `userId`.
Health endpoints per service (`/health`, `/health/ready`). Analytics captured at the API tier:
latency, token usage, retrieval quality signals, cost estimates.

## 7. Architecture Decision Records

ADRs live in [docs/adr/](adr/). Key decisions:
- **ADR-0001** — Three-tier split with a dedicated AI microservice (isolation, independent
  scaling, language fit: Python for the AI ecosystem, Node for the product surface).
- **ADR-0002** — API owns all relational state; AI service is stateless per request.
- **ADR-0003** — Streaming via SSE proxied through the API rather than direct web↔AI.

Diagrams (ER, sequence, deployment) are added as their milestones land under `docs/diagrams/`.
