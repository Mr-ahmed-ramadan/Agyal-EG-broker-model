import { describe, expect, it } from 'vitest';
import { originChecker, parseOrigins } from '../../src/common/cors';

describe('CORS origins', () => {
  it('tolerates spaces, trailing slashes and capitals in CORS_ORIGINS', () => {
    expect(parseOrigins(' https://Admin.Egypt.agyal.net/, https://egypt.agyal.net ,,')).toEqual([
      'https://admin.egypt.agyal.net',
      'https://egypt.agyal.net',
    ]);
  });

  it('allows listed origins and requests without an origin, and reports refusals', () => {
    const refused: string[] = [];
    const check = originChecker(parseOrigins('https://admin.egypt.agyal.net'), (o) => refused.push(o));
    const result = (origin: string | undefined) => {
      let allowed: boolean | undefined;
      check(origin, (_err, allow) => (allowed = allow));
      return allowed;
    };
    expect(result('https://admin.egypt.agyal.net')).toBe(true);
    expect(result(undefined)).toBe(true);
    expect(result('https://evil.example')).toBe(false);
    expect(refused).toEqual(['https://evil.example']);
  });
});
