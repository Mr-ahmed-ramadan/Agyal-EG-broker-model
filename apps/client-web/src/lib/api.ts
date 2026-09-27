const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const DEFAULT_TENANT = import.meta.env.VITE_TENANT as string | undefined;
const BROKER_KEY = 'agyal.broker';
const TOKEN_PREFIX = 'agyal.client.token';

/** In-memory fallback when browser storage is unavailable (e.g. some private windows). */
const memory = new Map<string, string>();

function read(storage: 'local' | 'session', key: string): string | null {
  try {
    return (storage === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return memory.get(`${storage}:${key}`) ?? null;
  }
}

function write(storage: 'local' | 'session', key: string, value: string | null) {
  try {
    const s = storage === 'local' ? localStorage : sessionStorage;
    if (value) s.setItem(key, value);
    else s.removeItem(key);
  } catch {
    if (value) memory.set(`${storage}:${key}`, value);
    else memory.delete(`${storage}:${key}`);
  }
}

/**
 * Which broker this app shows: `?broker=<slug>` in the link (remembered for
 * the session, so prospect demo links work), else the build's VITE_TENANT,
 * else undefined (the API then finds the broker from this app's domain).
 */
export function currentBroker(): string | undefined {
  const fromLink = new URLSearchParams(window.location.search).get('broker');
  if (fromLink && /^[a-z0-9-]{3,40}$/.test(fromLink)) {
    write('session', BROKER_KEY, fromLink);
    return fromLink;
  }
  return read('session', BROKER_KEY) ?? DEFAULT_TENANT;
}

const BROKER = currentBroker();
/** Sign-ins are kept per broker, so one broker's session is never sent to another. */
const TOKEN_KEY = `${TOKEN_PREFIX}.${BROKER ?? window.location.hostname}`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  return read('local', TOKEN_KEY);
}

export function setToken(token: string | null) {
  write('local', TOKEN_KEY, token);
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(BROKER ? { 'X-Tenant': BROKER } : { 'X-Tenant-Host': window.location.hostname }),
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
