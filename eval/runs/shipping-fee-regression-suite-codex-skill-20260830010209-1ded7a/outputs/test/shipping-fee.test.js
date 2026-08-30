import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee } from '../src/shipping-fee.js';

test('ordinary Irish shipping', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('normalizes country names before pricing', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' ie ' }), 5);
});

test('charges half price to Irish members', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('charges the ordinary Great Britain rate', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('charges half price to Great Britain members', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('waives shipping at the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

test('returns null for unsupported countries', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: undefined }), null);
});
