import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The landing page is the first thing a retail saver reads, and it is written
 * to say what actually happens ("a company can fail to pay") rather than to
 * lean on the word "risk". That decision kept getting undone by ordinary
 * copy edits, so it is asserted here.
 *
 * This covers the landing copy only. src/i18n/messages.ts deliberately keeps
 * consent_RISK_DISCLOSURE: the risk disclosure is a named legal document, and
 * renaming it would misdescribe what the client agreed to.
 */
const content = readFileSync(fileURLToPath(new URL('../src/landing/content.ts', import.meta.url)), 'utf8');

test('the landing copy does not use the word "risk"', () => {
  const hits = content.split('\n')
    .map((line, i) => [i + 1, line])
    .filter(([, line]) => /\brisk\b/i.test(line));
  assert.deepEqual(hits, [], `landing/content.ts still says "risk":\n${hits.map(([n, l]) => `  ${n}: ${l.trim()}`).join('\n')}`);
});

test('nor «مخاطرة» in the Arabic copy', () => {
  const hits = content.split('\n')
    .map((line, i) => [i + 1, line])
    .filter(([, line]) => /مخاطر/.test(line));
  assert.deepEqual(hits, [], `landing/content.ts still says «مخاطرة»:\n${hits.map(([n, l]) => `  ${n}: ${l.trim()}`).join('\n')}`);
});

test('and the warning that replaced it is still there, in both languages', () => {
  assert.match(content, /can fail to pay/, 'the English comparison must still say a company can fail to pay');
  assert.match(content, /ممكن تتعثر/, 'the Arabic comparison must still say the company may default');
});
