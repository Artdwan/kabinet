// Thin fetch wrapper talking to the real backend (server/). Replaces the
// old localStorage-only mockApi — this is the module a real deployment
// actually depends on now.

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || "/api";
const TOKEN_KEY = "kabinet:token";

let token: string | null = localStorage.getItem(TOKEN_KEY);

export function setToken(t: string | null): void {
  token = t;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return token;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, body });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new ApiError(data.error || `Ошибка запроса (${res.status})`, res.status);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

/**
 * Fetches a protected file. The token travels in the Authorization header,
 * so unlike a plain <a href> the URL never carries it into history or logs.
 * Caller owns the returned object URL and should revokeObjectURL it.
 */
async function openBlob(path: string): Promise<string> {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new ApiError(`Не удалось загрузить файл (${res.status})`, res.status);
  return URL.createObjectURL(await res.blob());
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  blob: openBlob,
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body as BodyInit }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body as BodyInit }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", body: formData }),
};
