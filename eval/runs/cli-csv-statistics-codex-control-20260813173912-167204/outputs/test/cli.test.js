'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { calculate } = require('../src/cli');

test('counts rows and averages numeric columns', () => {
  assert.deepEqual(calculate('name,count,time\na,2,10\nb,4,20\n'), {
    rowCount: 2,
    means: { count: 3, time: 15 },
  });
});

test('handles quoted commas, escaped quotes, and CRLF', () => {
  assert.deepEqual(calculate('label,value\r\n"a,b",1.5\r\n"say ""hi""",2.5\r\n'), {
    rowCount: 2,
    means: { value: 2 },
  });
});

test('does not classify incomplete or non-numeric columns as numeric', () => {
  assert.deepEqual(calculate('a,b,c\n1,2,\n3,no,4\n'), {
    rowCount: 2,
    means: { a: 2 },
  });
});
