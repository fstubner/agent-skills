import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('_normalizeCountry', async (t) => {
  await t.test('converts to uppercase', () => {
    assert.equal(_normalizeCountry('ie'), 'IE');
    assert.equal(_normalizeCountry('gb'), 'GB');
    assert.equal(_normalizeCountry('Ie'), 'IE');
  });

  await t.test('trims whitespace', () => {
    assert.equal(_normalizeCountry(' ie '), 'IE');
    assert.equal(_normalizeCountry('  GB  '), 'GB');
  });

  await t.test('handles null and undefined', () => {
    assert.equal(_normalizeCountry(null), '');
    assert.equal(_normalizeCountry(undefined), '');
  });

  await t.test('handles empty string', () => {
    assert.equal(_normalizeCountry(''), '');
  });

  await t.test('handles non-string values', () => {
    assert.equal(_normalizeCountry(123), '123');
  });
});

test('shippingFee', async (t) => {
  await t.test('returns null for unsupported countries', () => {
    assert.equal(shippingFee({ subtotal: 50, country: 'US' }), null);
    assert.equal(shippingFee({ subtotal: 50, country: 'FR' }), null);
    assert.equal(shippingFee({ subtotal: 50, country: 'de' }), null);
  });

  await t.test('returns null when country is null or undefined', () => {
    assert.equal(shippingFee({ subtotal: 50, country: null }), null);
    assert.equal(shippingFee({ subtotal: 50, country: undefined }), null);
  });

  await t.test('returns null for empty country string', () => {
    assert.equal(shippingFee({ subtotal: 50, country: '' }), null);
  });

  await t.test('returns 0 when subtotal >= 100 (IE)', () => {
    assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
    assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
    assert.equal(shippingFee({ subtotal: 1000, country: 'IE' }), 0);
  });

  await t.test('returns 0 when subtotal >= 100 (GB)', () => {
    assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
    assert.equal(shippingFee({ subtotal: 200, country: 'GB' }), 0);
  });

  await t.test('returns base fee 5 for non-member IE when subtotal < 100', () => {
    assert.equal(shippingFee({ subtotal: 0, country: 'IE' }), 5);
    assert.equal(shippingFee({ subtotal: 50, country: 'IE' }), 5);
    assert.equal(shippingFee({ subtotal: 99, country: 'IE' }), 5);
  });

  await t.test('returns base fee 10 for non-member GB when subtotal < 100', () => {
    assert.equal(shippingFee({ subtotal: 0, country: 'GB' }), 10);
    assert.equal(shippingFee({ subtotal: 50, country: 'GB' }), 10);
    assert.equal(shippingFee({ subtotal: 99, country: 'GB' }), 10);
  });

  await t.test('returns halved base fee 2.5 for member IE when subtotal < 100', () => {
    assert.equal(shippingFee({ subtotal: 0, country: 'IE', member: true }), 2.5);
    assert.equal(shippingFee({ subtotal: 50, country: 'IE', member: true }), 2.5);
    assert.equal(shippingFee({ subtotal: 99, country: 'IE', member: true }), 2.5);
  });

  await t.test('returns halved base fee 5 for member GB when subtotal < 100', () => {
    assert.equal(shippingFee({ subtotal: 0, country: 'GB', member: true }), 5);
    assert.equal(shippingFee({ subtotal: 50, country: 'GB', member: true }), 5);
    assert.equal(shippingFee({ subtotal: 99, country: 'GB', member: true }), 5);
  });

  await t.test('member flag defaults to false', () => {
    assert.equal(shippingFee({ subtotal: 50, country: 'IE' }), 5);
    assert.equal(shippingFee({ subtotal: 50, country: 'GB' }), 10);
  });

  await t.test('normalizes country input', () => {
    assert.equal(shippingFee({ subtotal: 50, country: 'ie' }), 5);
    assert.equal(shippingFee({ subtotal: 50, country: ' IE ' }), 5);
    assert.equal(shippingFee({ subtotal: 50, country: 'gb' }), 10);
    assert.equal(shippingFee({ subtotal: 50, country: ' GB ' }), 10);
  });

  await t.test('returns 0 for free shipping regardless of member status', () => {
    assert.equal(shippingFee({ subtotal: 100, country: 'IE', member: true }), 0);
    assert.equal(shippingFee({ subtotal: 100, country: 'IE', member: false }), 0);
    assert.equal(shippingFee({ subtotal: 100, country: 'GB', member: true }), 0);
    assert.equal(shippingFee({ subtotal: 100, country: 'GB', member: false }), 0);
  });

  await t.test('boundary case: subtotal exactly 100', () => {
    assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
    assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
  });

  await t.test('boundary case: subtotal just below 100', () => {
    assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
    assert.equal(shippingFee({ subtotal: 99.99, country: 'GB' }), 10);
  });

  await t.test('zero subtotal', () => {
    assert.equal(shippingFee({ subtotal: 0, country: 'IE' }), 5);
    assert.equal(shippingFee({ subtotal: 0, country: 'GB' }), 10);
  });

  await t.test('negative subtotal treated as < 100', () => {
    assert.equal(shippingFee({ subtotal: -50, country: 'IE' }), 5);
    assert.equal(shippingFee({ subtotal: -50, country: 'GB' }), 10);
  });
});
