#!/usr/bin/env bash
#
# One-command local dev launcher for CampusBrain.
# Starts Postgres + Redis (Docker), the AI service, the API, and the web app —
# all from current source — and tears them all down on Ctrl+C.
#
#   ./scripts/dev.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_PORT="${POSTGRES_PORT:-55432}"

log() { printf '\033[1;36m[dev]\033[0m %s\n' "$1"; }

pids=()
cleanup() {
  log "Shutting down…"
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

# ── 1. Infra: Postgres + Redis ──
log "Starting Postgres + Redis (port ${PG_PORT})…"
POSTGRES_PORT="${PG_PORT}" docker compose \
  -f "${ROOT}/infra/docker/docker-compose.yml" \
  --env-file "${ROOT}/.env" up -d

log "Waiting for Postgres…"
for _ in $(seq 1 30); do
  if docker exec campusbrain-postgres pg_isready -U campusbrain >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# ── 2. Migrate ──
log "Applying migrations…"
( cd "${ROOT}/apps/api" && npm run prisma:deploy >/dev/null 2>&1 || npx prisma migrate deploy )

# ── 3. AI service (FastAPI) ──
log "Starting AI service on :8000…"
(
  cd "${ROOT}/services/ai-service"
  # shellcheck disable=SC1091
  source .venv/bin/activate
  exec uvicorn app.main:app --port 8000
) &
pids+=("$!")

# ── 4. API (NestJS) ──
log "Starting API on :3001…"
( cd "${ROOT}/apps/api" && exec npm run start:dev ) &
pids+=("$!")

# ── 5. Web (Next.js) ──
log "Starting web on :3000…"
( cd "${ROOT}/apps/web" && exec npm run dev ) &
pids+=("$!")

log "All services starting. Open http://localhost:3000  (Ctrl+C to stop)"
wait
