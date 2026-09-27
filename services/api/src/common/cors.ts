/** Browser origins are compared as scheme://host[:port]: lowercase, no trailing slash. */
export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '').toLowerCase();
}

/** Parses a comma-separated CORS_ORIGINS value, tolerating spaces, trailing slashes and case. */
export function parseOrigins(value: string): string[] {
  return value.split(',').map(normalizeOrigin).filter(Boolean);
}

/**
 * Origin check for `enableCors`. Requests without an Origin header (curl, health checks,
 * server-to-server) are allowed; refused origins are reported so the logs show the mismatch.
 */
export function originChecker(allowed: string[], onRefused: (origin: string) => void) {
  const set = new Set(allowed);
  return (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || set.has(normalizeOrigin(origin))) return cb(null, true);
    onRefused(origin);
    cb(null, false);
  };
}
