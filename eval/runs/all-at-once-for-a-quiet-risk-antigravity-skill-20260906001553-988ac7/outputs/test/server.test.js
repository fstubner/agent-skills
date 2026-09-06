import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';
import { feeMinor } from '../src/pricing.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('feeMinor calculates single total rounding by default', () => {
  // e.g. 2 lines of 100 minor units (1.00) at 150 basis points (1.5%)
  // Line calculation: 100 * 150 / 10000 = 1.5 -> rounds to 2 per line = 4 total
  // Single total calculation: 200 * 150 / 10000 = 3 -> 3 total
  const lineTotals = [100, 100];
  const rate = 150;
  assert.equal(feeMinor(lineTotals, rate), 3);
});

test('feeMinor calculates per-line rounding when feature flag is active', () => {
  const lineTotals = [100, 100];
  const rate = 150;
  assert.equal(feeMinor(lineTotals, rate, { perLine: true }), 4);
});
