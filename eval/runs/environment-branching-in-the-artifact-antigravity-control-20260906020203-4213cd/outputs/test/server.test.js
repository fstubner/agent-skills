process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';
import { feeMinor } from '../src/fees.js';

import { requireSecondFactor } from '../src/auth.js';
import { sendReceipt } from '../src/mailer.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('a fee is charged on the invoice total using bankers rounding in all environments', () => {
  const lineTotals = [10_000, 5_000];
  const rate = 250;

  process.env.ENVIRONMENT = 'production';
  const prodFee = feeMinor(lineTotals, rate);

  process.env.ENVIRONMENT = 'staging';
  const stagingFee = feeMinor(lineTotals, rate);

  assert.equal(stagingFee, prodFee);
  assert.equal(stagingFee, 375);
});

test('requireSecondFactor allows requests without hardware key in staging', () => {
  process.env.ENVIRONMENT = 'staging';
  let nextCalled = false;
  requireSecondFactor({}, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('requireSecondFactor blocks requests without hardware key in production', () => {
  process.env.ENVIRONMENT = 'production';
  let statusCode = 0;
  let jsonBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; }
  };
  const req = { get: () => null };
  requireSecondFactor(req, res, () => {});
  assert.equal(statusCode, 401);
  assert.deepEqual(jsonBody, { error: 'second factor required' });
});

test('sendReceipt suppresses emails outside production', async () => {
  process.env.ENVIRONMENT = 'staging';
  // Should complete without throwing or calling fetch
  await sendReceipt('customer@example.com', 375);
});


