import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

// Country normalization tests
test('normalizes whitespace and case', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(_normalizeCountry('Ie'), 'IE');
  assert.equal(_normalizeCountry('gb'), 'GB');
  assert.equal(_normalizeCountry('  GB  '), 'GB');
});

test('handles null and undefined countries', () => {
  assert.equal(_normalizeCountry(null), '');
  assert.equal(_normalizeCountry(undefined), '');
});

test('handles empty string', () => {
  assert.equal(_normalizeCountry(''), '');
});

// Ireland shipping tests
test('Ireland: standard shipping fee under 100', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 50, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 99, country: 'IE' }), 5);
});

test('Ireland: free shipping at 100 or above', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 1000, country: 'IE' }), 0);
});

test('Ireland: member discount', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 99, member: true, country: 'IE' }), 2.5);
});

test('Ireland: member free shipping at threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
});

// Great Britain shipping tests
test('GB: standard shipping fee under 100', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
  assert.equal(shippingFee({ subtotal: 50, country: 'GB' }), 10);
  assert.equal(shippingFee({ subtotal: 99, country: 'GB' }), 10);
});

test('GB: free shipping at 100 or above', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
  assert.equal(shippingFee({ subtotal: 150, country: 'GB' }), 0);
  assert.equal(shippingFee({ subtotal: 1000, country: 'GB' }), 0);
});

test('GB: member discount', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
  assert.equal(shippingFee({ subtotal: 99, member: true, country: 'GB' }), 5);
});

test('GB: member free shipping at threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

// Unsupported countries
test('unsupported countries return null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: 'DE' }), null);
});

test('null country returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: null }), null);
});

test('undefined country returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: undefined }), null);
});

// Edge cases
test('member flag defaults to false', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'IE', member: false }), 5);
});

test('case insensitive country codes', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'Ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'gb' }), 10);
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('whitespace in country codes', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' IE ' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: '  GB  ' }), 10);
});
