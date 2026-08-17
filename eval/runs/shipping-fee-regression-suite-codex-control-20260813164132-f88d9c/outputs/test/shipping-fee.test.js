import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('ordinary Irish shipping', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('ordinary GB shipping', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('normalizes the private country helper', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
});

test('returns a result for a member', () => {
  assert.ok(shippingFee({ subtotal: 20, member: true, country: 'IE' }));
});

test('members pay half-price shipping in Ireland', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('members pay half-price shipping in Great Britain', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('normalizes country input before calculating the fee', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' gb ' }), 10);
});

test('returns null for an unsupported country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
});

test('returns null when country is missing', () => {
  assert.equal(shippingFee({ subtotal: 20 }), null);
});

test('waives shipping at the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, country: 'GB', member: true }), 0);
});

test('waives shipping above the free-shipping threshold', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'GB' }), 0);
});
