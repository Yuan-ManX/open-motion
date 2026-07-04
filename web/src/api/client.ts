import { authHeaders } from "./auth.js";

const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body
      ? { "Content-Type": "application/json", ...authHeaders() }
      : { ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      msg = "unauthorized — set your API key via the 🔑 button in the toolbar";
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string): Promise<T> => request<T>("GET", path);
export const apiPost = <T>(path: string, body?: unknown): Promise<T> => request<T>("POST", path, body);
export const apiPut = <T>(path: string, body?: unknown): Promise<T> => request<T>("PUT", path, body);
export const apiPatch = <T>(path: string, body?: unknown): Promise<T> => request<T>("PATCH", path, body);
export const apiDelete = <T>(path: string): Promise<T> => request<T>("DELETE", path);
