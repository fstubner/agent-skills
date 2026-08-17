import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('charges the standard Irish fee below the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
});

test('charges the standard GB fee below the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('waives shipping at exactly the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('halves the fee for members in both supported countries', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('normalizes country casing and surrounding whitespace', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(shippingFee({ subtotal: 20, country: ' gb ' }), 10);
});

test('returns null for unsupported or missing countries', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
  assert.equal(shippingFee({ subtotal: 20 }), null);
});
