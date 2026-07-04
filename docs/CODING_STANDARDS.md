# Coding Standards

Applies to all tiers. Enforced by linters/formatters and CI where possible.

## Universal
- **Feature-based folders**, not file-type folders. Group by domain (`auth/`, `documents/`,
  `chat/`), each holding its own controllers/services/dto/tests.
- **No placeholders.** No `TODO`, `FIXME`, stubbed returns, or pseudocode in committed code.
- **Explicit errors.** Never swallow exceptions. Wrap external calls; propagate typed errors.
- **Small units.** Functions do one thing; files stay focused. Prefer composition over inheritance.
- **Every public boundary is validated** (Zod on web, class-validator DTOs on api, Pydantic on ai).

## TypeScript (web + api)
- `strict: true`. No `any` — use `unknown` + narrowing. No non-null `!` on untrusted data.
- Named exports; no default exports except Next.js pages/layouts requiring them.
- Prettier + ESLint (typescript-eslint). Import order enforced.

## NestJS (api)
- Layering: **Controller** (HTTP + DTOs) → **Service** (use-case/domain) → **Repository**
  (Prisma access). Controllers never touch Prisma; repositories never contain business rules.
- One module per feature. Providers registered at module scope; global concerns (filters,
  interceptors, guards) registered once in the root module.
- DTOs for every request/response. Global `ValidationPipe` with whitelist + transform.

## Python (ai-service)
- Type hints everywhere; `mypy` clean. Pydantic models at all I/O boundaries.
- Each LangGraph agent is its own module with a single responsibility and pure-ish node fn.
- `ruff` (lint) + `black` (format). No bare `except`.

## Testing
- Unit tests co-located with features. api: Jest. web: Vitest + Testing Library.
  ai: pytest. e2e for critical flows (auth, ingestion, chat).
- A milestone is not "done" until its build/typecheck/lint/tests pass.

## Commits
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`).
- One logical change per commit; keep the tree green.
