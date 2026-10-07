import { describe, expect, it } from 'vitest';
import { normalizeEgyptMobile } from '../../src/domain/mobile';

describe('normalizeEgyptMobile', () => {
  it('accepts the ways a number is actually written', () => {
    for (const written of [
      '01012345678',
      '0101 234 5678',
      '010 1234 5678',
      '0101-234-5678',
      '(010) 1234 5678',
      '010.1234.5678',
      '  01012345678  ',
      '+201012345678',
      '+20 101 234 5678',
      '00201012345678',
      '201012345678',
      '٠١٠١٢٣٤٥٦٧٨',
    ]) {
      expect(normalizeEgyptMobile(written), `"${written}" should normalise`).toBe('01012345678');
    }
  });

  it('handles every operator prefix in use', () => {
    for (const p of ['010', '011', '012', '015']) {
      expect(normalizeEgyptMobile(`${p}12345678`)).toBe(`${p}12345678`);
      expect(normalizeEgyptMobile(`+20 ${p.slice(1)} 1234 5678`)).toBe(`${p}12345678`);
    }
  });

  it('refuses what is not an Egyptian mobile', () => {
    for (const bad of [
      '0221234567', // Cairo landline
      '0101234567', // one digit short
      '010123456789', // one digit long
      '01312345678', // no such operator prefix
      '+971501234567', // another country
      '12345',
      'not a number',
      '',
      '   ',
    ]) {
      expect(normalizeEgyptMobile(bad), `"${bad}" should be refused`).toBeNull();
    }
  });
});
