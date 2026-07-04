# Local Development

## Prerequisites
- **Node 22+**, **Python 3.11+**, **Docker** (for Postgres + Redis)
- No paid API keys required — the AI service runs on deterministic fakes until
  you add `OPENAI_API_KEY` / `PINECONE_API_KEY`.

## Fastest path — one command

```bash
cp .env.example .env
./scripts/dev.sh
```

This starts Postgres + Redis (Docker), applies migrations, and launches the AI
service (:8000), API (:3001), and web app (:3000) from **current source**. Open
<http://localhost:3000>. Ctrl+C stops everything.

> First run only: create the AI service venv and install deps —
> `cd services/ai-service && python3.11 -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt`,
> and `npm install` in `apps/api` and `apps/web`.

## Everything in Docker

```bash
cp .env.example .env
docker compose -f infra/docker/docker-compose.full.yml --env-file .env up --build
```

Builds and runs all five services. Open <http://localhost:3000>.

## Manual (four terminals)

| # | Service | Command | Port |
|---|---------|---------|------|
| 1 | Infra | `POSTGRES_PORT=55432 docker compose -f infra/docker/docker-compose.yml --env-file .env up -d` | 55432 / 6379 |
| 2 | AI | `cd services/ai-service && source .venv/bin/activate && uvicorn app.main:app --port 8000` | 8000 |
| 3 | API | `cd apps/api && npm run start:dev` | 3001 |
| 4 | Web | `cd apps/web && npm run dev` | 3000 |

> **If a new feature 404s or errors after you pulled changes**, your running
> service is on stale code — restart it (or use `./scripts/dev.sh`, which always
> runs current source).

## Common tasks

```bash
# Make yourself an admin (then log out/in to refresh the token)
cd apps/api && npm run make-admin -- you@example.com

# Prisma
npm run prisma:migrate        # create + apply a migration (dev)
npm run prisma:studio         # browse the database

# Tests
cd apps/api && npm test && npx jest --config ./test/jest-e2e.json
cd services/ai-service && pytest
cd apps/web && npm run build
```

## Going live with real AI
Add to `services/ai-service/.env`:
```
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX=campusbrain
RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2   # optional, needs sentence-transformers
```
No code changes — the providers switch from fakes to real automatically.
