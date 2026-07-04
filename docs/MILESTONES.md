# CampusBrain — Milestone Roadmap

We build in vertical, shippable slices. Each milestone leaves the repo in a working,
demoable state — no milestone depends on code from a future one to run.

**Workflow per milestone:** (1) architecture & design decisions → (2) folder structure →
(3) complete production code, no placeholders → (4) self-verification (build/typecheck/lint/tests)
→ (5) **your approval** before the next milestone.

---

### Milestone 0 — Foundation & architecture *(current)*
Monorepo scaffold, roadmap, architecture + ADRs, coding standards, root tooling
(`.gitignore`, `.editorconfig`, `.env.example`), Docker Compose skeleton for local infra.
**Exit:** repo structure and contracts agreed; `docker compose up` brings up Postgres + Redis.

### Milestone 1 — Backend core (NestJS) + database
NestJS app bootstrapped with Clean Architecture layout, Prisma schema for the full data model
(Users, Roles, Sessions, RefreshTokens, Documents, Chats, Messages, Subjects, Courses, PYQs,
EmbeddingMetadata, Analytics, Feedback, Notifications, Bookmarks, Flashcards, QuizAttempts,
StudyPlans, UsageLogs, AdminLogs, PromptTemplates) with indexes, FKs, soft deletes, audit
fields. Config module, global exception filter, logging interceptor, health checks, Swagger.
**Exit:** migrations run against Compose Postgres; `/health` + Swagger live; unit tests green.

### Milestone 2 — Auth & user management
JWT access/refresh, Passport strategies, guards, RBAC (student/admin), session + refresh-token
rotation, Clerk integration on the web side. Rate limiting, request validation, DTOs.
**Exit:** register/login/refresh/logout + protected routes; e2e auth tests green.

### Milestone 3 — AI service skeleton (FastAPI) + contract
FastAPI app, Pydantic settings, health checks, typed request/response contracts shared with
NestJS, Pinecone/Redis clients, streaming endpoint stub, structured logging. NestJS↔AI client
with retries, timeouts, health checks, error propagation.
**Exit:** NestJS proxies a streamed echo answer end-to-end through the AI service.

### Milestone 4 — Ingestion pipeline
Upload (Multer + Cloudinary) → queue (BullMQ) → AI service ingest: OCR (when needed), text
clean, semantic + recursive chunking, embeddings, metadata extraction (subject/semester/branch/
type/year/unit/topic), Pinecone upsert, Postgres metadata. Document management + status.
**Exit:** upload a PDF, watch it become searchable; ingestion status visible via API.

### Milestone 5 — Multi-agent RAG pipeline (LangGraph)
Planner → Retriever → Hybrid Search (BM25 + dense) → Reranker (cross-encoder) → Reasoning →
Verification (hallucination detection) → Answer Generator → Citation → Reflection. Parent-doc
retrieval, multi-query, context compression, metadata filtering, source attribution.
**Exit:** grounded, cited answers with streaming; refuses when context is absent; eval harness.

### Milestone 6 — Chat experience (web)
Streaming ChatGPT-style UI: markdown, syntax highlighting, tables, citations, regenerate/stop/
continue, suggested prompts, search/rename/pin chats, export PDF, full history.
**Exit:** end-to-end chat with real documents, polished and responsive.

### Milestone 7 — Study tools
Notes, flashcards, quizzes, revision sheets, summaries, formula extraction, doc comparison,
similar-PYQ finder, placement/interview prep, resume ATS analysis, study planner, recommendations.
**Exit:** each tool works against uploaded content with persistence.

### Milestone 8 — Admin & analytics
Admin dashboard (institutional uploads, user/subject/course management, document status),
analytics (DAU, latency, retrieval quality, token/embedding/LLM cost, top topics, engagement).
**Exit:** admin can operate the platform; dashboards read real metrics.

### Milestone 9 — Hardening & deployment
Full test coverage pass, load/perf checks, security review, CI/CD (GitHub Actions), Dockerfiles,
deploy configs (Vercel / Railway|Render / Render / Neon / Upstash / Pinecone), runbooks,
onboarding docs, ER/sequence/architecture diagrams finalized.
**Exit:** reproducible deploy; green pipelines; complete docs.

---

**Dependency order:** 0 → 1 → 2 → 3 → 4 → 5 are sequential (each builds on the last).
6, 7, 8 can be reordered after 5 lands. 9 is continuous but formalized at the end.
