import { test } from 'node:test';
import assert from 'node:assert';
import { discountMinor } from '../src/discount.js';

test('below the threshold the base rate applies', () => {
  assert.equal(discountMinor(5000, 2026), 250);
});

test('at the threshold the higher rate applies', () => {
  assert.equal(discountMinor(10000, 2026), 1000);
});

test('a five year member gets the loyalty uplift on top', () => {
  // 10000 * (0.10 + 0.05) = 1500
  assert.equal(discountMinor(10000, 2021), 1500);
});

test('loyalty is capped at five years', () => {
  assert.equal(discountMinor(10000, 2010), 1500);
});
