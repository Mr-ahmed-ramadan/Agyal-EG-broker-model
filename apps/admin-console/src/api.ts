/** Agyal operators work across brokers, so no X-Tenant header is sent. */
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Network failure (API down, wrong VITE_API_URL, CORS): say where we tried, not just "Failed to fetch". */
function unreachable(): never {
  throw new Error(`Can't reach the server at ${API_URL}. Please try again shortly.`);
}

const TOKEN_KEY = 'agyal.admin.token';

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
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(unreachable);
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    const issues = data?.issues?.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`);
    throw new ApiError(issues?.join('; ') || data?.message || res.statusText, res.status);
  }
  return data as T;
}

/** Downloads an authenticated file (e.g. CSV export) and saves it with the server's file name. */
export async function download(path: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(unreachable);
  if (!res.ok) throw new ApiError(`Download failed (${res.status})`, res.status);
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'export.csv';
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Opens an authenticated HTML page (e.g. a document preview) in a new tab. */
export async function openHtml(path: string) {
  const tab = window.open('', '_blank');
  const token = getToken();
  try {
    const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(unreachable);
    if (!res.ok) throw new ApiError(`Preview failed (${res.status})`, res.status);
    const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}
