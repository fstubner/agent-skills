import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('normalizes country codes by trimming whitespace and uppercasing', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(_normalizeCountry('gb'), 'GB');
});

test('charges the standard Irish fee below the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('charges the standard UK fee below the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('halves the Irish fee for members', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('halves the UK fee for members', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('shipping is free at exactly the threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('shipping remains free above the threshold for members and non-members', () => {
  assert.equal(shippingFee({ subtotal: 101, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 101, member: true, country: 'GB' }), 0);
});

test('accepts normalized country input when calculating the fee', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' ie ' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'gb' }), 10);
});

test('returns null for unsupported or missing countries', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20 }), null);
});
