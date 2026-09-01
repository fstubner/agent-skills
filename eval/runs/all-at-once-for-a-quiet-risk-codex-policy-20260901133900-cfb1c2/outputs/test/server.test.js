import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';
import { feeMinor } from '../src/pricing.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('feeMinor rounds once after summing the invoice total', () => {
  // Per-line rounding would produce 2, while invoice-total rounding produces 1.
  assert.equal(feeMinor([1, 1], 5_000), 1);
});

test('feeMinor preserves exact whole-minor-unit fees', () => {
  assert.equal(feeMinor([10_000], 250), 250);
});

test('feeMinor rejects invalid fee inputs', () => {
  assert.throws(() => feeMinor([100, -1], 250), /line totals/);
  assert.throws(() => feeMinor([100], -1), /rate basis points/);
});
