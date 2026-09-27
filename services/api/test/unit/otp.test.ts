import { describe, expect, it } from 'vitest';
import { canIssue, checkCode, generateCode, hashCode, maskMobile, OTP_MAX_ATTEMPTS } from '../../src/domain/otp';

const secret = 'test-secret';
const now = new Date('2026-09-27T12:00:00Z');

function challenge(code: string, over: Partial<{ attempts: number; expiresAt: Date; consumedAt: Date | null }> = {}) {
  return {
    id: 'ch-1',
    codeHash: hashCode(secret, 'ch-1', code),
    expiresAt: new Date(now.getTime() + 60_000),
    attempts: 0,
    consumedAt: null,
    ...over,
  };
}

describe('OTP codes', () => {
  it('generates 6-digit codes', () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it('binds the hash to the challenge', () => {
    expect(hashCode(secret, 'a', '123456')).not.toBe(hashCode(secret, 'b', '123456'));
  });

  it('accepts the right code and rejects others', () => {
    expect(checkCode(secret, challenge('042317'), '042317', now)).toBe('OK');
    expect(checkCode(secret, challenge('042317'), '042318', now)).toBe('INVALID');
    expect(checkCode(secret, challenge('042317'), 'abc', now)).toBe('INVALID');
  });

  it('refuses expired, used and over-attempted challenges even with the right code', () => {
    expect(checkCode(secret, challenge('111111', { expiresAt: now }), '111111', now)).toBe('EXPIRED');
    expect(checkCode(secret, challenge('111111', { consumedAt: now }), '111111', now)).toBe('ALREADY_USED');
    expect(checkCode(secret, challenge('111111', { attempts: OTP_MAX_ATTEMPTS }), '111111', now)).toBe('TOO_MANY_ATTEMPTS');
  });
});

describe('OTP rate limit', () => {
  it('enforces a cooldown between codes', () => {
    const r = canIssue([new Date(now.getTime() - 10_000)], now);
    expect(r).toEqual({ ok: false, retryAfterMs: 20_000 });
    expect(canIssue([new Date(now.getTime() - 31_000)], now)).toEqual({ ok: true });
  });

  it('caps codes per hour', () => {
    const recent = Array.from({ length: 6 }, (_, i) => new Date(now.getTime() - (i + 1) * 5 * 60_000));
    const r = canIssue(recent, now);
    expect(r.ok).toBe(false);
    expect(canIssue(recent.slice(0, 5), now)).toEqual({ ok: true });
  });

  it('masks mobile numbers', () => {
    expect(maskMobile('01012345678')).toBe('•••• 5678');
  });
});
