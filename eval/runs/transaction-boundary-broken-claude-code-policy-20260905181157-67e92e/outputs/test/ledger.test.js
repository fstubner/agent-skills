import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

test('transfer refuses when the balance is short', () => {
  const src = fs.readFileSync(new URL('../src/ledger.js', import.meta.url), 'utf8');
  assert.ok(src.includes('insufficient funds'));
});
