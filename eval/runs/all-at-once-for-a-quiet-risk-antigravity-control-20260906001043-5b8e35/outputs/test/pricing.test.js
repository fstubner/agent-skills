import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMinor } from '../src/pricing.js';

test('feeMinor calculates total fee rounded on invoice total', () => {
  // Example: line totals [100, 200, 300] = 600 minor units. Rate = 500 basis points (5%)
  // (600 * 500) / 10000 = 30
  assert.equal(feeMinor([100, 200, 300], 500), 30);

  // Rounding check: 105 * 250 / 10000 = 2.625 -> Math.round -> 3
  assert.equal(feeMinor([35, 35, 35], 250), 3);
});
