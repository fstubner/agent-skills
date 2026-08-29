import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('Irish shipping - non-member', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('Irish shipping - member discount', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('GB shipping - non-member', () => {
  assert.equal(shippingFee({ subtotal: 50, country: 'GB' }), 10);
});

test('GB shipping - member discount', () => {
  assert.equal(shippingFee({ subtotal: 50, member: true, country: 'GB' }), 5);
});

test('free shipping at threshold - IE', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
});

test('free shipping above threshold - GB', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'GB' }), 0);
});

test('charged shipping just below threshold - IE', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
});

test('charged shipping just below threshold - GB', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'GB' }), 10);
});

test('unsupported country returns null', () => {
  assert.equal(shippingFee({ subtotal: 50, country: 'US' }), null);
});

test('empty country returns null', () => {
  assert.equal(shippingFee({ subtotal: 50, country: '' }), null);
});

test('null country returns null', () => {
  assert.equal(shippingFee({ subtotal: 50, country: null }), null);
});

test('undefined country returns null', () => {
  assert.equal(shippingFee({ subtotal: 50 }), null);
});

test('normalizes country to uppercase', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
});

test('normalizes mixed case country', () => {
  assert.equal(_normalizeCountry('Gb'), 'GB');
});

test('normalizes null country to empty string', () => {
  assert.equal(_normalizeCountry(null), '');
});

test('normalizes undefined country to empty string', () => {
  assert.equal(_normalizeCountry(undefined), '');
});

test('member flag defaults to false', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('member flag explicitly false', () => {
  assert.equal(shippingFee({ subtotal: 20, member: false, country: 'IE' }), 5);
});
