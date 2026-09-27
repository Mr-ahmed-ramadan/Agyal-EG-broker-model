import { randomBytes } from 'node:crypto';

/** Unguessable link token (~128 bits, URL-safe). */
export function newDocToken(): string {
  return randomBytes(16).toString('base64url');
}

export function isDocToken(s: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(s);
}

/** "Chrome · iOS" from a user-agent string. */
export function shortUserAgent(ua: string | null | undefined): string {
  if (!ua) return '—';
  const os = /iphone|ipad|ios/i.test(ua) ? 'iOS' : /android/i.test(ua) ? 'Android' : /mac os|macintosh/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : /linux/i.test(ua) ? 'Linux' : '';
  const br = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : /bot|crawl|preview|slack|whatsapp|linkedin/i.test(ua) ? 'Link preview' : 'Browser';
  return [br, os].filter(Boolean).join(' · ');
}

/** Primary language tag from Accept-Language ("ar-EG,ar;q=0.9" -> "AR"). */
export function primaryLang(acceptLanguage: string | null | undefined): string | null {
  const tag = acceptLanguage?.split(',')[0]?.trim().split(/[-;]/)[0];
  return tag ? tag.slice(0, 5).toUpperCase() : null;
}

/** A short, readable recipient label ("Nile National Bank — Treasury" kept as typed, trimmed). */
export function cleanRecipient(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 120);
}

/** Replaces {{KEY}} placeholders; unknown keys are left as they are. */
export function fillTemplate(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k: string) => (k in values ? values[k] : m));
}
