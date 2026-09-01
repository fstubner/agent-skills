import { test } from 'node:test';
import assert from 'node:assert';
import { submit } from '../src/claims.js';

test('a claim is stored with an id', () => {
  assert.ok(submit({ amount: '10' }).id);
});
