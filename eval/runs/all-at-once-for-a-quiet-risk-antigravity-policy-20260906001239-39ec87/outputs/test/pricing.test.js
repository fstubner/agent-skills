import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMinor } from '../src/pricing.js';

test('feeMinor rounds fee once on invoice total', () => {
  // Example: line items [105, 205], rate 150 basis points (1.5%)
  // total = 310. 310 * 150 / 10000 = 4.65 -> rounded to 5
  assert.equal(feeMinor([105, 205], 150), 5);
});
