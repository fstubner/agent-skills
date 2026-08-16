import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('normalizes country codes before applying shipping rules', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(shippingFee({ subtotal: 20, country: ' ie ' }), 5);
});

test('charges the standard fee for a non-member in Ireland', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('charges the standard fee for a non-member in Great Britain', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('charges half price for members in Ireland and Great Britain', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('provides free shipping at the threshold and above', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
  assert.equal(shippingFee({ subtotal: 101, country: 'GB' }), 0);
});

test('charges shipping just below the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 99.99, member: true, country: 'GB' }), 5);
});

test('returns null for unsupported or missing countries', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: '' }), null);
  assert.equal(shippingFee({ subtotal: 20 }), null);
});
