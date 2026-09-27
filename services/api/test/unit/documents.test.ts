import { describe, expect, it } from 'vitest';
import { cleanRecipient, fillTemplate, isDocToken, newDocToken, primaryLang, shortUserAgent } from '../../src/domain/documents';

describe('tracked documents', () => {
  it('creates unguessable, distinct tokens', () => {
    const a = newDocToken();
    expect(isDocToken(a)).toBe(true);
    expect(a).not.toBe(newDocToken());
    expect(isDocToken('../../etc/passwd')).toBe(false);
    expect(isDocToken('short')).toBe(false);
  });

  it('describes devices and languages', () => {
    expect(shortUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile Safari/604.1')).toBe('Chrome · iOS');
    expect(shortUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36')).toBe('Chrome · Mac');
    expect(shortUserAgent('WhatsApp/2.23')).toBe('Link preview');
    expect(shortUserAgent(null)).toBe('—');
    expect(primaryLang('ar-EG,ar;q=0.9,en;q=0.8')).toBe('AR');
    expect(primaryLang('en-GB')).toBe('EN');
    expect(primaryLang(undefined)).toBeNull();
  });

  it('cleans recipients and fills placeholders', () => {
    expect(cleanRecipient('  Nile   National Bank — Treasury ')).toBe('Nile National Bank — Treasury');
    expect(fillTemplate('<a href="{{CLIENT_APP_URL}}">{{X}}</a> {{UNKNOWN}}', { CLIENT_APP_URL: 'https://x', X: 'y' })).toBe('<a href="https://x">y</a> {{UNKNOWN}}');
  });
});
