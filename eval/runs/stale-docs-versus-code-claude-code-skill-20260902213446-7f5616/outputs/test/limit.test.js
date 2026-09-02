import { test } from 'node:test';
import assert from 'node:assert';
import { rateLimit } from '../src/limit.js';

test('requests under the limit pass through', () => {
  const mw = rateLimit({ windowMs: 60000, max: 2 });
  let passed = 0;
  const next = () => { passed += 1; };
  const res = { status: () => ({ json: () => {} }) };
  mw({ ip: 'a' }, res, next);
  mw({ ip: 'a' }, res, next);
  assert.equal(passed, 2);
});
