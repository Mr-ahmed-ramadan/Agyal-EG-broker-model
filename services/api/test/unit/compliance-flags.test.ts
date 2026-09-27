import { describe, expect, it } from 'vitest';
import { amlFlag, daysInQueue, isReviewOverdue, resolutionProblem } from '../../src/domain/compliance-flags';

describe('KYC/AML monitoring', () => {
  it('ranks AML results', () => {
    expect(amlFlag(null)).toBe('NONE');
    expect(amlFlag({ isPep: false, hits: [] })).toBe('NONE');
    expect(amlFlag({ isPep: true, hits: [] })).toBe('PEP');
    expect(amlFlag({ isPep: true, hits: [{ list: 'SANCTIONS', name: 'x' }] })).toBe('SANCTIONS');
    expect(amlFlag({ hits: [{ list: 'ADVERSE_MEDIA', name: 'x' }] })).toBe('HIT');
  });

  it('measures queue age and overdue reviews', () => {
    const now = new Date('2026-09-28T12:00:00Z');
    expect(daysInQueue(new Date('2026-09-25T13:00:00Z'), null, now)).toBe(2);
    expect(daysInQueue(new Date('2026-09-25T13:00:00Z'), new Date('2026-09-26T00:00:00Z'), now)).toBe(0);
    expect(daysInQueue(null, null, now)).toBe(0);
    expect(isReviewOverdue(new Date('2026-09-27T00:00:00Z'), now)).toBe(true);
    expect(isReviewOverdue(new Date('2027-09-27T00:00:00Z'), now)).toBe(false);
    expect(isReviewOverdue(null, now)).toBe(false);
  });

  it('only lets a broker resolve an open flag with an explanation', () => {
    expect(resolutionProblem('OPEN', 'Escalated to MLRO, EDD done')).toBeNull();
    expect(resolutionProblem('OPEN', 'ok')).toMatch(/explain/);
    expect(resolutionProblem('RESOLVED', 'Escalated to MLRO')).toMatch(/already/);
  });
});
