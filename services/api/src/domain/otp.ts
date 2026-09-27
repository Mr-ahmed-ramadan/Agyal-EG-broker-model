import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * One-time codes (ADR 0010). Codes are 6 random digits, stored only as an
 * HMAC bound to the challenge id, valid for a short time and a few attempts.
 */

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
/** Minimum gap before re-sending a code for the same purpose and action */
export const OTP_RESEND_COOLDOWN_MS = 30_000;
/** Maximum codes per user per rolling hour, all purposes together */
export const OTP_MAX_PER_HOUR = 10;

export type OtpPurpose = 'LOGIN' | 'VERIFY_MOBILE' | 'STEP_UP';

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashCode(secret: string, challengeId: string, code: string): string {
  return createHmac('sha256', secret).update(`${challengeId}:${code}`).digest('base64');
}

export interface ChallengeState {
  id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}

export type VerifyResult = 'OK' | 'INVALID' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'ALREADY_USED';

/** Decides whether `code` answers the challenge. The caller counts the attempt. */
export function checkCode(secret: string, c: ChallengeState, code: string, now = new Date()): VerifyResult {
  if (c.consumedAt) return 'ALREADY_USED';
  if (c.expiresAt <= now) return 'EXPIRED';
  if (c.attempts >= OTP_MAX_ATTEMPTS) return 'TOO_MANY_ATTEMPTS';
  if (!/^\d{6}$/.test(code)) return 'INVALID';
  const expected = Buffer.from(c.codeHash);
  const actual = Buffer.from(hashCode(secret, c.id, code));
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? 'OK' : 'INVALID';
}

/**
 * Rate limit for issuing codes. `recent` are the user's codes of the last hour
 * (any purpose); `sameKind` are those for the same purpose and action, which
 * are subject to the resend cooldown. Distinct actions (e.g. add a bank
 * account, then withdraw) are only limited by the hourly cap.
 */
export function canIssue(
  recent: Date[],
  sameKind: Date[],
  now = new Date(),
): { ok: true } | { ok: false; retryAfterMs: number } {
  const lastHour = recent.filter((d) => now.getTime() - d.getTime() < 3_600_000);
  const latest = Math.max(0, ...sameKind.map((d) => d.getTime()));
  if (latest && now.getTime() - latest < OTP_RESEND_COOLDOWN_MS) {
    return { ok: false, retryAfterMs: OTP_RESEND_COOLDOWN_MS - (now.getTime() - latest) };
  }
  if (lastHour.length >= OTP_MAX_PER_HOUR) {
    const oldest = Math.min(...lastHour.map((d) => d.getTime()));
    return { ok: false, retryAfterMs: 3_600_000 - (now.getTime() - oldest) };
  }
  return { ok: true };
}

export function maskMobile(mobile: string): string {
  return `•••• ${mobile.slice(-4)}`;
}
