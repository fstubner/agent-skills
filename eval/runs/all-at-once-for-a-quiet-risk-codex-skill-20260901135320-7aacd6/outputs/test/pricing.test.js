import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMinor } from '../src/pricing.js';

test('rounds the fee once after summing invoice lines', () => {
  // At 5%, per-line rounding gives 2, while invoice-total rounding gives 1.
  assert.equal(feeMinor([10, 10], 500), 1);
});

test('handles an empty invoice', () => {
  assert.equal(feeMinor([], 500), 0);
});
