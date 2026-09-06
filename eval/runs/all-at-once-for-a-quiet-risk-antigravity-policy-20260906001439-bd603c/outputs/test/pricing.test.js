import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMinor } from '../src/pricing.js';

test('feeMinor calculates fee on total invoice amount', () => {
  // Line items: [149, 149] = 298 total
  // Rate: 500 basis points (5%)
  // Total rounding: Math.round(298 * 500 / 10000) = Math.round(14.9) = 15
  assert.equal(feeMinor([149, 149], 500), 15);
  assert.equal(feeMinor([100, 200, 300], 250), 15); // 600 * 250 / 10000 = 15
});

test('feeMinor handles empty line items array', () => {
  assert.equal(feeMinor([], 500), 0);
});

test('feeMinor validates input arguments at trust boundaries', () => {
  assert.throws(() => feeMinor(null, 500), TypeError);
  assert.throws(() => feeMinor('not-an-array', 500), TypeError);
  assert.throws(() => feeMinor([100], -10), TypeError);
  assert.throws(() => feeMinor([100], 'invalid'), TypeError);
});
