import { test } from 'node:test';
import assert from 'node:assert';
import { log } from '../src/log.js';

test('log writes one JSON line', () => {
  const written = [];
  const original = process.stdout.write;
  process.stdout.write = (s) => { written.push(s); return true; };
  log('test.event', { correlationId: 'c1' });
  process.stdout.write = original;
  assert.equal(written.length, 1);
  assert.equal(JSON.parse(written[0]).event, 'test.event');
});
