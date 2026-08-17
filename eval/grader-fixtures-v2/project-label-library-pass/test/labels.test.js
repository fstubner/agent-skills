import test from 'node:test';
import assert from 'node:assert/strict';
import { formatProjectLabel, normalizeName } from '../src/labels.js';
test('exports both label helpers', () => {
  assert.equal(normalizeName('  Atlas   App '), 'Atlas App');
  assert.equal(formatProjectLabel('Atlas', 'active'), 'Atlas [active]');
});
