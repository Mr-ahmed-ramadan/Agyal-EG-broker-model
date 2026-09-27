/** Helpers for prospect demos and the public contact form. */

/** URL-safe broker slug from a firm name: "Beltone Securities" -> "beltone-securities". */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
    .replace(/-+$/g, '');
  return slug.length >= 3 ? slug : `broker-${slug || 'demo'}`.slice(0, 36);
}

function channel(hex: string, i: number): number {
  const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

/** Readable text colour (white or near-black) on a brand background. */
export function contrastText(background: string): string {
  const l = luminance(background);
  const contrastWhite = 1.05 / (l + 0.05);
  const contrastDark = (l + 0.05) / (luminance('#111111') + 0.05);
  return contrastWhite >= contrastDark ? '#ffffff' : '#111111';
}

export const MAX_LOGO_BYTES = 200 * 1024;

/** Accepts PNG/JPEG/WebP data URLs up to 200 KB (no SVG: it can carry scripts). */
export function logoProblem(dataUrl: string): string | null {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return 'Logo must be a PNG, JPEG or WebP image';
  const bytes = Math.floor((m[2].length * 3) / 4) - (m[2].endsWith('==') ? 2 : m[2].endsWith('=') ? 1 : 0);
  if (bytes > MAX_LOGO_BYTES) return 'Logo must be 200 KB or smaller';
  return null;
}

/** Sliding-window rate limiter kept in memory (per API instance). */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Records a hit; returns false if the key is over the limit. */
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
