import { describe, expect, it } from 'vitest';
import { ageOn, decide, parseNationalId, scoreSuitability } from '../../src/domain/onboarding-rules';

describe('national ID', () => {
  it('parses birth date and gender', () => {
    const info = parseNationalId('29001011234567');
    expect(info?.dateOfBirth.toISOString().slice(0, 10)).toBe('1990-01-01');
    expect(info?.governorateCode).toBe('12');
    expect(info?.gender).toBe('FEMALE'); // 13th digit 6 is even
  });

  it('rejects bad formats and impossible dates', () => {
    expect(parseNationalId('1900101123456')).toBeNull();
    expect(parseNationalId('19001011234567')).toBeNull();
    expect(parseNationalId('29002301234567')).toBeNull(); // 30 Feb
  });

  it('computes age', () => {
    const dob = new Date('2000-06-15T00:00:00Z');
    expect(ageOn(dob, new Date('2026-06-14T00:00:00Z'))).toBe(25);
    expect(ageOn(dob, new Date('2026-06-15T00:00:00Z'))).toBe(26);
  });
});

describe('suitability and decision', () => {
  it('scores risk profiles', () => {
    expect(scoreSuitability({ horizon: 1, lossTolerance: 1, experience: 1 })).toBe('CONSERVATIVE');
    expect(scoreSuitability({ horizon: 2, lossTolerance: 2, experience: 2 })).toBe('BALANCED');
    expect(scoreSuitability({ horizon: 3, lossTolerance: 3, experience: 2 })).toBe('GROWTH');
  });

  const rule = { enabled: true, maxRiskRating: 'LOW' as const, version: 'v1' };

  it('auto-approves clean applications', () => {
    expect(decide(rule, { ekycPassed: true, riskRating: 'LOW', isPep: false, age: 30 })).toEqual({
      outcome: 'AUTO_APPROVE',
      ruleVersion: 'v1',
    });
  });

  it('routes flagged applications to review with reasons', () => {
    const d = decide(rule, { ekycPassed: false, riskRating: 'HIGH', isPep: true, age: 19 });
    expect(d.outcome).toBe('MANUAL_REVIEW');
    if (d.outcome === 'MANUAL_REVIEW') expect(d.reasons).toHaveLength(4);
  });
});
