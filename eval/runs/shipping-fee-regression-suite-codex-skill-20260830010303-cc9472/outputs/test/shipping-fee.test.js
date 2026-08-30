import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('charges the ordinary Irish rate below the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('charges the ordinary GB rate below the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('halves the Irish rate for members', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('halves the GB rate for members', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('offers free shipping at exactly the threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

test('offers free shipping above the threshold', () => {
  assert.equal(shippingFee({ subtotal: 100.01, country: 'GB' }), 0);
});

test('charges shipping just below the threshold', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'GB' }), 10);
});

test('normalizes country whitespace and casing through the public function', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' ie ' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: ' gb ' }), 10);
});

test('returns null for unsupported, blank, and missing countries', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: '  ' }), null);
  assert.equal(shippingFee({ subtotal: 20 }), null);
});

test('normalizes country values consistently', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(_normalizeCountry(null), '');
});
