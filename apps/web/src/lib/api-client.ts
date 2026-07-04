import { authStore, useAuthStore } from '@/stores/auth-store';
import { endpoints } from './endpoints';
import type { AuthTokens } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Set false for auth endpoints that shouldn't attach/refresh a token. */
  auth?: boolean;
  signal?: AbortSignal;
}

let refreshPromise: Promise<AuthTokens | null> | null = null;

async function refreshTokens(): Promise<AuthTokens | null> {
  const current = authStore.get().tokens;
  if (!current?.refreshToken) return null;

  // Single-flight: concurrent 401s share one refresh call.
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}${endpoints.auth.refresh}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { tokens: AuthTokens };
        useAuthStore.getState().setTokens(data.tokens);
        return data.tokens;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function rawRequest(
  path: string,
  options: RequestOptions,
  token?: string,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.auth !== false && token) headers.authorization = `Bearer ${token}`;

  return fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
}

/** JSON request with transparent one-shot token refresh on 401. */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = authStore.get().tokens?.accessToken;
  let response = await rawRequest(path, options, token);

  if (response.status === 401 && options.auth !== false) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      response = await rawRequest(path, options, refreshed.accessToken);
    } else {
      useAuthStore.getState().clear();
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = (body as { error?: { code?: string; message?: string } })
      ?.error;
    throw new ApiError(
      error?.message ?? `Request failed (${response.status})`,
      response.status,
      error?.code,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export { API_URL };
