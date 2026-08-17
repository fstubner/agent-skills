import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('ordinary Irish shipping', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('normalizes country codes and missing values', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(_normalizeCountry('gb'), 'GB');
  assert.equal(_normalizeCountry(undefined), '');
  assert.equal(_normalizeCountry(null), '');
});

test('charges the standard fee by destination', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('halves the destination fee for members', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('provides free shipping at and above the threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
  assert.equal(shippingFee({ subtotal: 101, country: 'GB' }), 0);
});

test('returns null for unsupported destinations', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: ' iee ' }), null);
  assert.equal(shippingFee({ subtotal: 20 }), null);
});
