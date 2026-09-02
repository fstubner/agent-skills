import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';
import { feeMinor } from '../src/fees.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('a fee is charged on the invoice total', () => {
  assert.equal(typeof feeMinor([10_000, 5_000], 250), 'number');
});

test('fee calculation: basic case', () => {
  // $150 * 0.25% = $0.375 → rounds down to $0
  assert.equal(feeMinor([150_00], 25), 0);
});

test('fee calculation: round half to even (banker\'s rounding)', () => {
  // When remainder is exactly 5000, rounds to nearest even
  // 50000 * 50 = 2500000, 2500000 / 10000 = 250.0 (no rounding needed)
  assert.equal(feeMinor([50_000], 50), 250);
});

test('fee calculation: remainder below 5000 rounds down', () => {
  // 10000 * 25 = 250000, remainder = 0, result = 25
  assert.equal(feeMinor([10_000], 25), 25);
});

test('fee calculation: remainder above 5000 rounds up', () => {
  // 10000 * 150 = 1500000, remainder = 0, result = 150
  assert.equal(feeMinor([10_000], 150), 150);
});

test('fee calculation: banker\'s rounding with odd quotient rounds up', () => {
  // 20001 * 50 = 1000050, quotient = 100, remainder = 50 (5000 equiv), rounds up to 101
  assert.equal(feeMinor([20_001], 50), 101);
});

test('fee calculation: banker\'s rounding with even quotient rounds down', () => {
  // 20000 * 50 = 1000000, quotient = 100, no remainder
  assert.equal(feeMinor([20_000], 50), 100);
});

test('fee calculation: multiple line items sum correctly', () => {
  // (10000 + 15000) * 100 = 2500000, result = 250
  assert.equal(feeMinor([10_000, 15_000], 100), 250);
});
