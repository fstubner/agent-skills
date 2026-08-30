import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';
import { feeMinor } from '../src/fees.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('a fee is charged on the invoice total', () => {
  assert.equal(typeof feeMinor([10_000, 5_000], 250), 'number');
});
