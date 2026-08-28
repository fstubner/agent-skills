const { test } = require('node:test');
const assert = require('node:assert');
const { assign } = require('../src/assign');

test('module loads', () => { assert.ok(assign); });
