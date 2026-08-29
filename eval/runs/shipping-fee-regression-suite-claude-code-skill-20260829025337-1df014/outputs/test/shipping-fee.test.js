import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

// Country normalization tests
test('normalizes country to uppercase', () => {
  assert.equal(_normalizeCountry('ie'), 'IE');
  assert.equal(_normalizeCountry('gb'), 'GB');
});

test('trims whitespace from country', () => {
  assert.equal(_normalizeCountry('  IE  '), 'IE');
  assert.equal(_normalizeCountry('\tGB\n'), 'GB');
});

test('handles null and undefined as empty string', () => {
  assert.equal(_normalizeCountry(null), '');
  assert.equal(_normalizeCountry(undefined), '');
});

test('handles empty string', () => {
  assert.equal(_normalizeCountry(''), '');
});

// Unsupported country tests
test('returns null for unsupported country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
});

test('returns null for null country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: null }), null);
});

test('returns null for undefined country', () => {
  assert.equal(shippingFee({ subtotal: 20 }), null);
});

// Free shipping threshold tests
test('returns 0 for Ireland when subtotal >= 100', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
});

test('returns 0 for GB when subtotal >= 100', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
  assert.equal(shippingFee({ subtotal: 200, country: 'GB' }), 0);
});

// Non-member shipping fee tests (IE)
test('Ireland non-member fee below threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 99, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 0, country: 'IE' }), 5);
});

test('Ireland non-member fee with explicit member=false', () => {
  assert.equal(shippingFee({ subtotal: 20, member: false, country: 'IE' }), 5);
});

// Non-member shipping fee tests (GB)
test('GB non-member fee below threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
  assert.equal(shippingFee({ subtotal: 99, country: 'GB' }), 10);
  assert.equal(shippingFee({ subtotal: 0, country: 'GB' }), 10);
});

test('GB non-member fee with explicit member=false', () => {
  assert.equal(shippingFee({ subtotal: 20, member: false, country: 'GB' }), 10);
});

// Member shipping fee tests (IE)
test('Ireland member fee below threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 99, member: true, country: 'IE' }), 2.5);
});

// Member shipping fee tests (GB)
test('GB member fee below threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
  assert.equal(shippingFee({ subtotal: 99, member: true, country: 'GB' }), 5);
});

// Member free shipping at threshold
test('Ireland member gets free shipping at threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
});

test('GB member gets free shipping at threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

// Case insensitive country codes
test('accepts lowercase country codes', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'gb' }), 10);
});

test('accepts mixed case country codes', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'Ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'Gb' }), 10);
});
