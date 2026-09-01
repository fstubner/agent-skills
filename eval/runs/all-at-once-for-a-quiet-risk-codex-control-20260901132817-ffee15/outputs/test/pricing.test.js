import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMinor } from '../src/pricing.js';

test('rounds the fee once after summing invoice lines', () => {
  // Rounding each line would produce 6; invoice-total rounding produces 5.
  assert.equal(feeMinor([101, 101], 250), 5);
});

test('rounds a half minor unit up on the invoice total', () => {
  assert.equal(feeMinor([100], 50), 1);
});

test('returns zero for an invoice with no lines', () => {
  assert.equal(feeMinor([], 250), 0);
});
