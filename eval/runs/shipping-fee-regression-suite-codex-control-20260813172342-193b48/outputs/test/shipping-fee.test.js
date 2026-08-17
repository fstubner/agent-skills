import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('ordinary Irish shipping', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('charges half price for Irish members', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('charges ordinary and member UK shipping', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('waives shipping at the free-shipping threshold for both countries', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('charges shipping just below the threshold', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 99.99, country: 'GB' }), 10);
});

test('normalizes country casing and surrounding whitespace', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(shippingFee({ subtotal: 20, country: ' gb ' }), 10);
});

test('returns null for unsupported or missing countries', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: undefined }), null);
});

test('normalizes falsy country values to an empty country code', () => {
  assert.equal(_normalizeCountry(null), '');
  assert.equal(_normalizeCountry(0), '');
});
