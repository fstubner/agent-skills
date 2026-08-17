import test from 'node:test';
import assert from 'node:assert/strict';
import { formatProjectLabel, normalizeName } from '../src/labels.js';
test('normalizes project names', () => assert.equal(normalizeName('  Atlas   App '), 'Atlas App'));

test('formats project labels for supported statuses', () => {
  assert.equal(formatProjectLabel('  Atlas   App ', 'active'), 'Atlas   App [active]');
  assert.equal(formatProjectLabel('Atlas App', 'paused'), 'Atlas App [paused]');
  assert.equal(formatProjectLabel('Atlas App', 'archived'), 'Atlas App [archived]');
});

test('rejects blank names and unsupported statuses', () => {
  assert.throws(() => formatProjectLabel('   ', 'active'), TypeError);
  assert.throws(() => formatProjectLabel('Atlas App', 'draft'), TypeError);
});
