import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

// Country normalization
test('_normalizeCountry: lowercase to uppercase', () => {
  assert.equal(_normalizeCountry('ie'), 'IE');
});

test('_normalizeCountry: trims whitespace', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
});

test('_normalizeCountry: handles mixed case and whitespace', () => {
  assert.equal(_normalizeCountry('  Gb  '), 'GB');
});

test('_normalizeCountry: converts null to empty string', () => {
  assert.equal(_normalizeCountry(null), '');
});

test('_normalizeCountry: converts undefined to empty string', () => {
  assert.equal(_normalizeCountry(undefined), '');
});

// Ireland shipping — non-member
test('IE non-member: low subtotal pays base fee', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('IE non-member: exactly at threshold gets free shipping', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
});

test('IE non-member: above threshold gets free shipping', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
});

test('IE non-member: zero subtotal pays base fee', () => {
  assert.equal(shippingFee({ subtotal: 0, country: 'IE' }), 5);
});

// Ireland shipping — member
test('IE member: low subtotal pays half base fee', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('IE member: at threshold gets free shipping', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
});

// GB shipping — non-member
test('GB non-member: low subtotal pays base fee', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('GB non-member: at threshold gets free shipping', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('GB non-member: above threshold gets free shipping', () => {
  assert.equal(shippingFee({ subtotal: 200, country: 'GB' }), 0);
});

// GB shipping — member
test('GB member: low subtotal pays half base fee', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('GB member: at threshold gets free shipping', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

// Unsupported countries
test('unsupported country: returns null for US', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
});

test('unsupported country: returns null for DE', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'DE' }), null);
});

test('unsupported country: returns null for missing country', () => {
  assert.equal(shippingFee({ subtotal: 20 }), null);
});

test('unsupported country: returns null for empty string', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '' }), null);
});

test('unsupported country: returns null for whitespace-only country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '   ' }), null);
});

// Member flag edge cases
test('member flag defaults to false', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('member flag explicit false behaves same as default', () => {
  assert.equal(shippingFee({ subtotal: 20, member: false, country: 'IE' }), 5);
});

test('member flag case-insensitive country', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'ie' }), 2.5);
});

test('member flag with whitespace in country', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: ' IE ' }), 2.5);
});
