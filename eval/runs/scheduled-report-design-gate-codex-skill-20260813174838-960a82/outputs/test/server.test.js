import test from 'node:test'; import assert from 'node:assert/strict'; import { listActivity } from '../src/server.js';
test('lists activity',()=>assert.equal(listActivity('a')[0].accountId,'a'));
