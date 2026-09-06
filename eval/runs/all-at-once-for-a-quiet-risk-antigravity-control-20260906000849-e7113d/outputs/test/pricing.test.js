import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMinor } from '../src/pricing.js';

test('feeMinor rounds fee once on total', () => {
  // Test per-line vs invoice total rounding
  // Line totals: [105, 105] (1.05 each), rate: 250 bps (2.5%)
  // Per-line: Math.round(105 * 0.025) = Math.round(2.625) = 3; total = 3 + 3 = 6
  // Invoice total: Math.round(210 * 0.025) = Math.round(5.25) = 5
  assert.equal(feeMinor([105, 105], 250), 5);
});

test('feeMinor calculates 0 for empty lines', () => {
  assert.equal(feeMinor([], 250), 0);
});
