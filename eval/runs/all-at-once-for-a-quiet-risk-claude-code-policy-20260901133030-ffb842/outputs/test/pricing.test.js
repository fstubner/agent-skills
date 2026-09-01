import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMinor, feeMinorLegacy } from '../src/pricing.js';

const RATE_BASIS_POINTS = 250; // 2.5% = 250 basis points

test('feeMinor (new algorithm): rounds once on invoice total', () => {
  // 100.00 (10000 minor units) * 2.5% = 2.50 (250 minor units)
  assert.equal(feeMinor([10000], RATE_BASIS_POINTS), 250);

  // 100.50 (10050 minor units) * 2.5% = 2.5125 → 3 minor units (rounded)
  assert.equal(feeMinor([10050], RATE_BASIS_POINTS), 253);

  // Multi-line: total 100.50, fee is 2.5125 → 3 minor units
  assert.equal(feeMinor([5000, 5050], RATE_BASIS_POINTS), 253);

  // Large invoice: 1000.00 * 2.5% = 25.00 (exactly)
  assert.equal(feeMinor([100000], RATE_BASIS_POINTS), 2500);

  // Edge case: 0 total = 0 fee
  assert.equal(feeMinor([], RATE_BASIS_POINTS), 0);
  assert.equal(feeMinor([0], RATE_BASIS_POINTS), 0);
});

test('feeMinor (new algorithm): rounding behavior matches banker\'s rounding', () => {
  // Math.round in JavaScript uses "round half away from zero" (not banker's)
  // 100.005 * 2.5% = 2.500125 → rounds to 3
  assert.equal(feeMinor([10000.5], RATE_BASIS_POINTS), 2500);

  // 100.004 * 2.5% = 2.50010 → rounds to 3
  assert.equal(feeMinor([10000.4], RATE_BASIS_POINTS), 2500);

  // 100.006 * 2.5% = 2.50015 → rounds to 3
  assert.equal(feeMinor([10000.6], RATE_BASIS_POINTS), 2501);
});

test('feeMinorLegacy (old algorithm): rounds per line, then sums', () => {
  // 100.00 (10000 minor units) * 2.5% = 2.50 (250 minor units)
  assert.equal(feeMinorLegacy([10000], RATE_BASIS_POINTS), 250);

  // Two lines of 50.00 each:
  // Line 1: 50.00 * 2.5% = 1.25 (125 minor) → rounds to 125 or 126
  // Line 2: 50.00 * 2.5% = 1.25 (125 minor) → rounds to 125 or 126
  // Total: 250 or 252
  // Actually: Math.round(5000 * 250 / 10000) = Math.round(125) = 125
  assert.equal(feeMinorLegacy([5000, 5000], RATE_BASIS_POINTS), 250);

  // Edge case: 0 total = 0 fee
  assert.equal(feeMinorLegacy([], RATE_BASIS_POINTS), 0);
  assert.equal(feeMinorLegacy([0], RATE_BASIS_POINTS), 0);
});

test('algorithms differ on fractional amounts that accumulate', () => {
  const lines = [3333, 3333, 3334]; // total = 10000
  // New: 10000 * 250 / 10000 = 250 (no fraction)
  assert.equal(feeMinor(lines, RATE_BASIS_POINTS), 250);
  // Legacy: 3333*250/10000 = 83.325→83, 83.325→83, 3334*250/10000 = 83.35→83
  // Total: 83+83+83 = 249
  assert.equal(feeMinorLegacy(lines, RATE_BASIS_POINTS), 249);
});

test('algorithms differ on odd-cent distributions', () => {
  const lines = [3334, 3333, 3333]; // total = 10000
  // New: same as above, 250
  assert.equal(feeMinor(lines, RATE_BASIS_POINTS), 250);
  // Legacy: 3334*250/10000 = 83.35→83, 83.325→83, 83.325→83
  // Total: 83+83+83 = 249
  assert.equal(feeMinorLegacy(lines, RATE_BASIS_POINTS), 249);
});

test('algorithms differ on fractional fee accumulation', () => {
  // Case where legacy rounding accumulates fractional fees differently
  const lines = [1000, 1000, 1000, 1000, 1000]; // 5.00 per line
  const rate = 350; // 3.5% = 350 basis points

  // New: 5000 * 350 / 10000 = 175
  assert.equal(feeMinor(lines, rate), 175);

  // Legacy: each line: 1000 * 350 / 10000 = 35 (exact)
  // Total: 35 * 5 = 175 (same in this case)
  assert.equal(feeMinorLegacy(lines, rate), 175);
});
