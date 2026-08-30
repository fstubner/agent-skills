import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee } from '../src/shipping-fee.js';

test('charges the standard Irish fee', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('charges the standard Great Britain fee', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('halves the Irish fee for members', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('halves the Great Britain fee for members', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('normalizes country casing and surrounding whitespace', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' ie ' }), 5);
});

test('offers free shipping at the subtotal threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('offers free shipping above the subtotal threshold', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'IE', member: true }), 0);
});

test('returns null for unsupported, missing, or blank countries', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20 }), null);
  assert.equal(shippingFee({ subtotal: 20, country: '  ' }), null);
});
