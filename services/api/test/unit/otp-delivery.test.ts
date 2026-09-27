import { describe, expect, it, vi } from 'vitest';
import { LogOtpDelivery, maskEmail, ResendEmailOtpDelivery } from '../../src/modules/identity/otp-delivery';
import { productionConfigProblems } from '../../src/common/config-check';

describe('OTP delivery', () => {
  it('emails the code through Resend under the broker name and masks the address', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"x"}', { status: 200 }));
    const d = new ResendEmailOtpDelivery('re_key', 'codes@example.com', fetchMock as unknown as typeof fetch);
    const sentTo = await d.deliver({ mobile: '01012345678', email: 'nour@example.com' }, '123456', 'Demo Securities', 'LOGIN');
    expect(sentTo).toBe('no•••@example.com');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_key');
    const body = JSON.parse(init.body);
    expect(body.from).toBe('Demo Securities <codes@example.com>');
    expect(body.to).toEqual(['nour@example.com']);
    expect(body.subject).toContain('123456');
  });

  it('surfaces Resend errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('domain not verified', { status: 403 }));
    const d = new ResendEmailOtpDelivery('re_key', 'codes@example.com', fetchMock as unknown as typeof fetch);
    await expect(d.deliver({ mobile: null, email: 'a@b.co' }, '1', 'X', 'STEP_UP')).rejects.toThrow(/403/);
  });

  it('logs in development and masks', async () => {
    expect(await new LogOtpDelivery().deliver({ mobile: '01000000004', email: 'd@x.eg' }, '1', 'X', 'LOGIN')).toBe('•••• 0004');
    expect(maskEmail('ab@x.eg')).toBe('ab•••@x.eg');
  });
});

describe('production config check', () => {
  const good = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@h/db',
    JWT_SECRET: 'x'.repeat(32),
    OTP_SECRET: 'y'.repeat(32),
    KMS_MASTER_KEY_LOCAL: 'z'.repeat(32),
    CORS_ORIGINS: 'https://invest.example.com',
    OTP_DELIVERY: 'resend',
    RESEND_API_KEY: 're_1',
    EMAIL_FROM: 'codes@example.com',
  };

  it('accepts a complete configuration', () => {
    expect(productionConfigProblems(good)).toEqual([]);
  });

  it('lists every missing or weak setting', () => {
    const problems = productionConfigProblems({ ...good, JWT_SECRET: 'short', RESEND_API_KEY: '', OTP_DEV_ECHO: 'true', OTP_DELIVERY: undefined });
    expect(problems.join(' ')).toMatch(/JWT_SECRET/);
    expect(problems.join(' ')).toMatch(/OTP_DELIVERY/);
    expect(problems.join(' ')).toMatch(/OTP_DEV_ECHO/);
  });

  it('does nothing outside production', () => {
    expect(productionConfigProblems({ NODE_ENV: 'development' })).toEqual([]);
  });
});
