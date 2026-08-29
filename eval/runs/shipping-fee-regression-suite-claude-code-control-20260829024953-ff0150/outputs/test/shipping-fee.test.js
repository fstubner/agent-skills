import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('_normalizeCountry: handles lowercase', () => {
  assert.equal(_normalizeCountry('ie'), 'IE');
  assert.equal(_normalizeCountry('gb'), 'GB');
});

test('_normalizeCountry: handles mixed case', () => {
  assert.equal(_normalizeCountry('Ie'), 'IE');
  assert.equal(_normalizeCountry('gB'), 'GB');
});

test('_normalizeCountry: trims whitespace', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(_normalizeCountry('  GB  '), 'GB');
});

test('_normalizeCountry: handles null/undefined', () => {
  assert.equal(_normalizeCountry(null), '');
  assert.equal(_normalizeCountry(undefined), '');
});

test('_normalizeCountry: handles empty string', () => {
  assert.equal(_normalizeCountry(''), '');
});

test('shippingFee: Ireland regular customer', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('shippingFee: Ireland member customer', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('shippingFee: GB regular customer', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('shippingFee: GB member customer', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('shippingFee: free shipping at threshold (subtotal = 100)', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('shippingFee: free shipping above threshold', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 1000, country: 'GB' }), 0);
});

test('shippingFee: free shipping ignores member flag', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

test('shippingFee: just below threshold', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 99.99, country: 'GB' }), 10);
});

test('shippingFee: unsupported country returns null', () => {
  assert.equal(shippingFee({ subtotal: 50, country: 'US' }), null);
  assert.equal(shippingFee({ subtotal: 50, country: 'FR' }), null);
});

test('shippingFee: missing country returns null', () => {
  assert.equal(shippingFee({ subtotal: 50 }), null);
});

test('shippingFee: empty country returns null', () => {
  assert.equal(shippingFee({ subtotal: 50, country: '' }), null);
});

test('shippingFee: null country returns null', () => {
  assert.equal(shippingFee({ subtotal: 50, country: null }), null);
});

test('shippingFee: case-insensitive country handling', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'Ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'gb' }), 10);
  assert.equal(shippingFee({ subtotal: 20, country: 'Gb' }), 10);
});

test('shippingFee: default member to false', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE', member: false }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('shippingFee: zero subtotal', () => {
  assert.equal(shippingFee({ subtotal: 0, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 0, country: 'GB' }), 10);
});

test('shippingFee: high subtotal below threshold', () => {
  assert.equal(shippingFee({ subtotal: 99, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 99, country: 'GB' }), 10);
});
