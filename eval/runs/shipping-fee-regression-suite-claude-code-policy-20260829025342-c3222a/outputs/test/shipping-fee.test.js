import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('_normalizeCountry', async (t) => {
  await t.test('normalizes lowercase to uppercase', () => {
    assert.equal(_normalizeCountry('ie'), 'IE');
  });

  await t.test('trims whitespace', () => {
    assert.equal(_normalizeCountry('  IE  '), 'IE');
  });

  await t.test('handles mixed case with whitespace', () => {
    assert.equal(_normalizeCountry(' ie '), 'IE');
  });

  await t.test('handles null as empty string', () => {
    assert.equal(_normalizeCountry(null), '');
  });

  await t.test('handles undefined as empty string', () => {
    assert.equal(_normalizeCountry(undefined), '');
  });
});

test('shippingFee: Ireland', async (t) => {
  await t.test('returns 5 for non-member with subtotal below 100', () => {
    assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  });

  await t.test('returns 2.5 for member with subtotal below 100', () => {
    assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
  });

  await t.test('returns 0 for non-member when subtotal equals 100', () => {
    assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  });

  await t.test('returns 0 for member when subtotal equals 100', () => {
    assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
  });

  await t.test('returns 0 for non-member when subtotal exceeds 100', () => {
    assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
  });

  await t.test('returns 0 for member when subtotal exceeds 100', () => {
    assert.equal(shippingFee({ subtotal: 150, member: true, country: 'IE' }), 0);
  });

  await t.test('normalizes country case (lowercase)', () => {
    assert.equal(shippingFee({ subtotal: 20, country: 'ie' }), 5);
  });

  await t.test('normalizes country case (mixed)', () => {
    assert.equal(shippingFee({ subtotal: 20, country: 'Ie' }), 5);
  });

  await t.test('trims country whitespace', () => {
    assert.equal(shippingFee({ subtotal: 20, country: '  IE  ' }), 5);
  });
});

test('shippingFee: UK', async (t) => {
  await t.test('returns 10 for non-member with subtotal below 100', () => {
    assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
  });

  await t.test('returns 5 for member with subtotal below 100', () => {
    assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
  });

  await t.test('returns 0 for non-member when subtotal equals 100', () => {
    assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
  });

  await t.test('returns 0 for member when subtotal equals 100', () => {
    assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
  });

  await t.test('returns 0 for non-member when subtotal exceeds 100', () => {
    assert.equal(shippingFee({ subtotal: 150, country: 'GB' }), 0);
  });

  await t.test('returns 0 for member when subtotal exceeds 100', () => {
    assert.equal(shippingFee({ subtotal: 150, member: true, country: 'GB' }), 0);
  });

  await t.test('normalizes country case (lowercase)', () => {
    assert.equal(shippingFee({ subtotal: 20, country: 'gb' }), 10);
  });

  await t.test('normalizes country case (mixed)', () => {
    assert.equal(shippingFee({ subtotal: 20, country: 'Gb' }), 10);
  });

  await t.test('trims country whitespace', () => {
    assert.equal(shippingFee({ subtotal: 20, country: '  GB  ' }), 10);
  });
});

test('shippingFee: unsupported countries', async (t) => {
  await t.test('returns null for unsupported country', () => {
    assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
  });

  await t.test('returns null for null country', () => {
    assert.equal(shippingFee({ subtotal: 20, country: null }), null);
  });

  await t.test('returns null for undefined country', () => {
    assert.equal(shippingFee({ subtotal: 20, country: undefined }), null);
  });

  await t.test('returns null for empty string country', () => {
    assert.equal(shippingFee({ subtotal: 20, country: '' }), null);
  });

  await t.test('returns null for whitespace-only country', () => {
    assert.equal(shippingFee({ subtotal: 20, country: '  ' }), null);
  });
});

test('shippingFee: member default parameter', async (t) => {
  await t.test('defaults member to false when not provided', () => {
    assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  });

  await t.test('explicitly handles member=false', () => {
    assert.equal(shippingFee({ subtotal: 20, member: false, country: 'IE' }), 5);
  });
});
