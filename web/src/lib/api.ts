import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./tokens";

const BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = 'error',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Endpoints that must never trigger the refresh-and-retry dance.
const NO_RETRY = ['/api/auth/refresh', '/api/auth/login', '/api/auth/register', '/api/auth/logout'];

let refreshPromise: Promise<boolean> | null = null;

/** Rotates the stored pair. Concurrent 401s share one in-flight call. */
function refreshSession(): Promise<boolean> {
  refreshPromise ??= (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // The refresh token is spent, expired, or revoked — nothing to salvage.
      clearTokens();
      return false;
    }

    const body = (await res.json()) as { accessToken: string; refreshToken: string };
    setTokens(body);
    return true;
  })()
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}, allowRetry = true): Promise<T> {
  const accessToken = getAccessToken();

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  // The access token expired; rotate it once and replay the request.
  if (res.status === 401 && allowRetry && !NO_RETRY.includes(path)) {
    if (await refreshSession()) return request<T>(path, init, false);
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (body as { error?: { message?: string; code?: string; details?: unknown } })?.error;
    throw new ApiError(res.status, err?.message ?? res.statusText, err?.code, err?.details);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
