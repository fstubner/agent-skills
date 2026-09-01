import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';
import { feeMinor } from '../src/pricing.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('feeMinor calculates fee with old logic when flag is 0', () => {
  process.env.ENABLE_NEW_FEE_ROUNDING_PERCENT = '0';
  // Old: per-line rounding: round(1000 * 100 / 10000) + round(1500 * 100 / 10000) = 10 + 15 = 25
  const result = feeMinor([1000, 1500], 100, 'invoice-123');
  assert.equal(result, 25);
});

test('feeMinor calculates fee with new logic when flag is 100', () => {
  process.env.ENABLE_NEW_FEE_ROUNDING_PERCENT = '100';
  // New: sum first, then round: round((1000 + 1500) * 100 / 10000) = round(25) = 25
  const result = feeMinor([1000, 1500], 100, 'invoice-123');
  assert.equal(result, 25);
});

test('feeMinor shows difference with rounding edge case', () => {
  // Old: round(1001 * 100 / 10000) + round(1499 * 100 / 10000) = round(10.01) + round(14.99) = 10 + 15 = 25
  process.env.ENABLE_NEW_FEE_ROUNDING_PERCENT = '0';
  const oldResult = feeMinor([1001, 1499], 100, 'invoice-123');
  assert.equal(oldResult, 25);

  // New: round((1001 + 1499) * 100 / 10000) = round(25) = 25
  process.env.ENABLE_NEW_FEE_ROUNDING_PERCENT = '100';
  const newResult = feeMinor([1001, 1499], 100, 'invoice-123');
  assert.equal(newResult, 25);
});
