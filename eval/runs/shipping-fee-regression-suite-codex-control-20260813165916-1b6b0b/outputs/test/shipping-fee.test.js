import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('charges the standard Irish rate below the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('charges the standard GB rate below the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('applies the member discount to each country rate', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('waives shipping at exactly the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('waives shipping above the free-shipping threshold for members too', () => {
  assert.equal(shippingFee({ subtotal: 150, member: true, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 150, member: true, country: 'GB' }), 0);
});

test('normalizes country casing and surrounding whitespace', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(shippingFee({ subtotal: 20, country: ' gb ' }), 10);
});

test('normalizes missing and falsy country values to an empty code', () => {
  assert.equal(_normalizeCountry(), '');
  assert.equal(_normalizeCountry(null), '');
  assert.equal(_normalizeCountry(0), '');
});

test('returns null for unsupported countries', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: ' ' }), null);
  assert.equal(shippingFee({ subtotal: 20 }), null);
});
