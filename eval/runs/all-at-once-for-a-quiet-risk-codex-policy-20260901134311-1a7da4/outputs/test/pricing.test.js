import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMinor } from '../src/pricing.js';

test('feeMinor rounds once on the invoice total', () => {
  // 1.5 cents on each line: per-line rounding would produce 4 cents,
  // while invoice-total rounding produces the processor-compatible 3 cents.
  assert.equal(feeMinor([15, 15], 1000), 3);
});

test('feeMinor handles an empty invoice', () => {
  assert.equal(feeMinor([], 250), 0);
});
