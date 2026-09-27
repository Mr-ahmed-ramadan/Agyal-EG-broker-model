import { describe, expect, it } from 'vitest';
import { shouldAudit } from '../../src/common/audit.interceptor';
import { currentContext, newRequestContext, runWithContext } from '../../src/common/request-context';

describe('audit trail', () => {
  it('audits every write and admin reads of personal data, not public reads', () => {
    expect(shouldAudit('POST', '/auth/login')).toBe(true);
    expect(shouldAudit('PUT', '/admin/economics')).toBe(true);
    expect(shouldAudit('DELETE', '/broker/news/1')).toBe(true);
    expect(shouldAudit('GET', '/admin/data/360/client/abc')).toBe(true);
    expect(shouldAudit('GET', '/admin/compliance/clients/abc')).toBe(true);
    expect(shouldAudit('GET', '/admin/compliance/clients')).toBe(false);
    expect(shouldAudit('GET', '/instruments')).toBe(false);
    expect(shouldAudit('GET', '/health')).toBe(false);
    expect(shouldAudit('GET', '/d/abc123')).toBe(false); // document opens have their own log
  });

  it('keeps the request context across async work', async () => {
    const ctx = newRequestContext('10.0.0.1', 'x'.repeat(400));
    expect(ctx.userAgent).toHaveLength(300);
    await runWithContext(ctx, async () => {
      await new Promise((r) => setTimeout(r, 1));
      currentContext()!.actorId = 'u1';
      expect(currentContext()).toMatchObject({ ip: '10.0.0.1', actorId: 'u1', requestId: ctx.requestId });
    });
    expect(currentContext()).toBeUndefined();
  });
});

import { redactRow, TABLES } from '../../src/modules/platform-data/platform-data.service';
import Decimal from 'decimal.js';

describe('data console redaction', () => {
  it('masks secrets, shortens logos and serialises numbers', () => {
    const row = redactRow({
      id: 'u1',
      passwordHash: 'scrypt$abc',
      nationalIdEncrypted: null,
      branding: { displayName: 'X', logoUrl: `data:image/png;base64,${'A'.repeat(500)}` },
      seq: BigInt(7),
      amount: new Decimal('12.50'),
      at: new Date('2026-09-28T00:00:00Z'),
    });
    expect(row.passwordHash).toBe('[redacted]');
    expect(row.nationalIdEncrypted).toBeNull();
    expect(String((row.branding as { logoUrl: string }).logoUrl)).toMatch(/…/);
    expect(row.seq).toBe('7');
    expect(row.amount).toBe('12.5');
    expect(row.at).toBeInstanceOf(Date);
  });

  it('lists the audit tables in the console', () => {
    expect(Object.keys(TABLES)).toEqual(expect.arrayContaining(['Client', 'Order', 'JournalEntry', 'AuditLog', 'DataChange']));
  });
});
