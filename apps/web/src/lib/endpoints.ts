/**
 * Single source of truth for every API route the web app calls.
 *
 * - The **base URL** and **prefix** come from env (`NEXT_PUBLIC_API_URL`,
 *   `NEXT_PUBLIC_API_PREFIX`) so they can be managed per-environment without
 *   touching code.
 * - The **paths** live here (not in `.env`) because they must match the NestJS
 *   controllers exactly; keeping them as typed constants means a typo fails to
 *   compile instead of 404-ing at runtime.
 *
 * Change the API location in `apps/web/.env.local`; change a route here.
 */

/** REST prefix set on the API via `app.setGlobalPrefix()` (default `api`). */
export const API_PREFIX = (
  process.env.NEXT_PUBLIC_API_PREFIX ?? 'api'
).replace(/^\/+|\/+$/g, '');

/** Prepend the configured prefix to a path, e.g. `/auth/login` → `/api/auth/login`. */
const p = (path: string): string => `/${API_PREFIX}${path}`;

export const endpoints = {
  auth: {
    login: p('/auth/login'),
    register: p('/auth/register'),
    logout: p('/auth/logout'),
    refresh: p('/auth/refresh'),
  },
  chats: {
    root: p('/chats'),
    byId: (id: string) => p(`/chats/${id}`),
    messages: (id: string) => p(`/chats/${id}/messages`),
  },
  documents: {
    root: p('/documents'),
    byId: (id: string) => p(`/documents/${id}`),
  },
  study: {
    summary: p('/study/summary'),
    flashcards: p('/study/flashcards'),
    flashcardsGenerate: p('/study/flashcards/generate'),
    quizGenerate: p('/study/quiz/generate'),
    quizSubmit: p('/study/quiz/submit'),
  },
  admin: {
    overview: p('/admin/analytics/overview'),
    messagesPerDay: p('/admin/analytics/messages'),
    documentsByType: p('/admin/analytics/documents-by-type'),
    users: p('/admin/users'),
    userStatus: (id: string) => p(`/admin/users/${id}/status`),
  },
} as const;
