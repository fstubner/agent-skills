import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('ordinary Irish shipping', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('normalizes country codes before applying shipping rules', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(shippingFee({ subtotal: 20, country: ' gb ' }), 10);
});

test('charges the exact member rates for each supported country', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('waives shipping at the free-shipping threshold for both countries', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

test('charges shipping just below the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 99.99, member: true, country: 'GB' }), 5);
});

test('returns null for unsupported or missing countries', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: '  ' }), null);
  assert.equal(shippingFee({ subtotal: 20 }), null);
});
