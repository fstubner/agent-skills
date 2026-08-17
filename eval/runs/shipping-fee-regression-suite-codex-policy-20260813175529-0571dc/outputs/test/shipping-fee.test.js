import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('charges the standard Irish shipping fee', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('normalizes country codes before applying shipping rules', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(shippingFee({ subtotal: 20, country: ' ie ' }), 5);
});

test('charges half price for members in each supported country', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('charges the standard GB shipping fee', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('waives shipping at the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

test('returns null for unsupported countries', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: ' iex ' }), null);
});
