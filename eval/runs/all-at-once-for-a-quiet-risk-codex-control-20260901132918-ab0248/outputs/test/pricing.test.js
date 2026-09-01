import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMinor } from '../src/pricing.js';

test('rounds the fee once on the invoice total', () => {
  // Per-line rounding would produce 2; invoice-total rounding produces 1.
  assert.equal(feeMinor([1, 1], 5_000), 1);
});

test('sums all lines before calculating the fee', () => {
  assert.equal(feeMinor([100, 250, 650], 250), 25);
});
