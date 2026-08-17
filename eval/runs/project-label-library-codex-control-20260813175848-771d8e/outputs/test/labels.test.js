import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName } from '../src/labels.js';
test('normalizes project names', () => assert.equal(normalizeName('  Atlas   App '), 'Atlas App'));
