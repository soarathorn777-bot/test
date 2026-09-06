import { clearToken, getToken } from "./tokens";

const BASE = import.meta.env.VITE_API_URL ?? "";

/** Field-level messages from the backend's Zod validation middleware. */
export type FieldErrors = Record<string, string[] | undefined>;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: FieldErrors,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The backend answers errors as `{ error: string }`, and validation failures
 * add `{ details: { field: string[] } }`.
 */
interface ErrorBody {
  error?: string;
  details?: FieldErrors;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  // There is no refresh endpoint: an expired or rejected token is simply dead.
  if (res.status === 401) clearToken();

  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => null)) as ErrorBody | null;

  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? res.statusText, body?.details);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
