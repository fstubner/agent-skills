import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';
import { feeMinor, feeMinorNewRounding, feeMinorOldRounding } from '../src/pricing.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('feeMinorNewRounding: round once on invoice total', () => {
  // Simple case: single line
  assert.equal(feeMinorNewRounding([1000], 100), 10);

  // Multiple lines, no rounding drift
  assert.equal(feeMinorNewRounding([1000, 2000], 100), 30);

  // Demonstrates the new behavior: total 3333 minor units at 100 bps = 33.33, rounds to 33
  assert.equal(feeMinorNewRounding([1111, 1111, 1111], 100), 33);
});

test('feeMinorOldRounding: round per-line then sum', () => {
  // Single line: same as new
  assert.equal(feeMinorOldRounding([1000], 100), 10);

  // Multiple lines: each rounds independently
  // Line 1: 1111 * 100 / 10000 = 11.11 → 11
  // Line 2: 1111 * 100 / 10000 = 11.11 → 11
  // Line 3: 1111 * 100 / 10000 = 11.11 → 11
  // Sum: 33 (same as new rounding in this case)
  assert.equal(feeMinorOldRounding([1111, 1111, 1111], 100), 33);

  // Case where rounding differs between old and new:
  // Old: (333*100/10000 rounded) + (333*100/10000 rounded) + (334*100/10000 rounded)
  //    = 3 + 3 + 4 = 10
  // New: (333+333+334)*100/10000 rounded = 1000*100/10000 rounded = 10
  assert.equal(feeMinorOldRounding([333, 333, 334], 100), 10);
});

test('feeMinor with new rounding (default)', () => {
  delete process.env.PRICING_ROUNDING_VERSION;
  assert.equal(feeMinor([1111, 1111, 1111], 100), 33);
});

test('feeMinor with new rounding (explicit)', () => {
  process.env.PRICING_ROUNDING_VERSION = 'new';
  assert.equal(feeMinor([1111, 1111, 1111], 100), 33);
  delete process.env.PRICING_ROUNDING_VERSION;
});

test('feeMinor with old rounding (rollback mode)', () => {
  process.env.PRICING_ROUNDING_VERSION = 'old';
  assert.equal(feeMinor([333, 333, 334], 100), 10);
  delete process.env.PRICING_ROUNDING_VERSION;
});

test('feeMinor rounding difference: new vs old on edge case', () => {
  // This case shows why the change matters for finance.
  // With per-line rounding you accumulate rounding errors.
  const lines = [333, 333, 333, 333, 333];
  const newFee = feeMinorNewRounding(lines, 100);
  const oldFee = feeMinorOldRounding(lines, 100);

  // New: (333*5)*100/10000 = 1665*100/10000 = 16.65 → 17
  assert.equal(newFee, 17);

  // Old: 5 × (333*100/10000 rounded) = 5 × 3 = 15
  assert.equal(oldFee, 15);

  // 2 minor units difference per invoice = material
  assert.equal(newFee - oldFee, 2);
});
