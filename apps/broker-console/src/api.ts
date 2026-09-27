const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TENANT = import.meta.env.VITE_TENANT as string | undefined;
const TOKEN_KEY = 'agyal.broker.token';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable (private mode); session lasts until reload
  }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // A fixed broker for single-broker demos; otherwise the broker is found from this app's domain.
      ...(TENANT ? { 'X-Tenant': TENANT } : { 'X-Tenant-Host': window.location.hostname }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    const issues = data?.issues?.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`);
    throw new ApiError(issues?.join('; ') || data?.message || res.statusText, res.status);
  }
  return data as T;
}
