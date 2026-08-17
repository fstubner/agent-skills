'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../src/cli');

test('counts rows and averages numeric columns', () => {
  assert.deepEqual(analyze('name,count,time\na,3,12\nb,5,18\n'), {
    rowCount: 2, means: { count: 4, time: 15 },
  });
});

test('supports quoted commas, escaped quotes, and blank numeric cells', () => {
  assert.deepEqual(analyze('label,value\n"a, one",2\n"say ""hi""",\n'), {
    rowCount: 2, means: { value: 2 },
  });
});

test('rejects malformed row widths', () => {
  assert.throws(() => analyze('a,b\n1\n'), /expected 2/);
});
