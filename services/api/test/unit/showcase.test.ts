import { describe, expect, it } from 'vitest';
import { contrastText, logoProblem, RateLimiter, slugify } from '../../src/domain/showcase';

describe('prospect demo helpers', () => {
  it('makes URL-safe slugs', () => {
    expect(slugify('Beltone Securities S.A.E.')).toBe('beltone-securities-s-a-e');
    expect(slugify('  Égypte Invest  ')).toBe('egypte-invest');
    expect(slugify('أرقام')).toBe('broker-demo');
    expect(slugify('AB')).toBe('broker-ab');
    expect(slugify('x'.repeat(60)).length).toBeLessThanOrEqual(36);
  });

  it('picks readable text colours', () => {
    expect(contrastText('#0b4f6c')).toBe('#ffffff');
    expect(contrastText('#f5c518')).toBe('#111111');
    expect(contrastText('#ffffff')).toBe('#111111');
  });

  it('validates logos', () => {
    const png = `data:image/png;base64,${Buffer.from('hello').toString('base64')}`;
    expect(logoProblem(png)).toBeNull();
    expect(logoProblem('data:image/svg+xml;base64,PHN2Zz4=')).toMatch(/PNG, JPEG or WebP/);
    expect(logoProblem('https://example.com/logo.png')).toMatch(/PNG, JPEG or WebP/);
    const big = `data:image/png;base64,${Buffer.alloc(210 * 1024).toString('base64')}`;
    expect(logoProblem(big)).toMatch(/200 KB/);
  });
});

describe('rate limiter', () => {
  it('allows up to the limit per window', () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.allow('ip', 0)).toBe(true);
    expect(rl.allow('ip', 10)).toBe(true);
    expect(rl.allow('ip', 20)).toBe(false);
    expect(rl.allow('other', 20)).toBe(true);
    expect(rl.allow('ip', 1015)).toBe(true);
  });
});
