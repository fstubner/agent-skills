import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';
import { feeMinor } from '../src/pricing.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('feeMinor rounds once after summing the invoice lines', () => {
  // Per-line rounding would produce 0; invoice-total rounding produces 1.
  assert.equal(feeMinor([1, 1], 2_500), 1);
});
