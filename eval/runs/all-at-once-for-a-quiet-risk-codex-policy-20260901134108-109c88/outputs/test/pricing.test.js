import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMinor } from '../src/pricing.js';

test('feeMinor rounds once after summing all invoice lines', () => {
  // Per-line rounding would produce 2; invoice-level rounding produces 1.
  assert.equal(feeMinor([1, 1], 5_000), 1);
});

test('feeMinor applies ordinary half-up rounding to the invoice total', () => {
  assert.equal(feeMinor([101], 50), 1); // 101 * 0.005 = 0.505 minor units
});

test('feeMinor handles empty invoices without inventing a fee', () => {
  assert.equal(feeMinor([], 250), 0);
});
