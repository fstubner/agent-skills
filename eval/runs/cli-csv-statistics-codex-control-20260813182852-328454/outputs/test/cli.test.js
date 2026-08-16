'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { parseCsv, summarize } = require('../src/cli');

test('summarizes numeric columns and row count', () => {
  assert.deepEqual(summarize('name,a,b\nx,1,10\ny,3,20\n'), {
    rowCount: 2,
    means: { a: 2, b: 15 }
  });
});

test('handles quoted commas, escaped quotes, and CRLF', () => {
  assert.deepEqual(parseCsv('name,note,value\r\n"A, Inc.","said ""hi""",2\r\n'), [
    ['name', 'note', 'value'], ['A, Inc.', 'said "hi"', '2']
  ]);
});

test('ignores blank lines and non-numeric columns', () => {
  assert.deepEqual(summarize('\ufefflabel,count\nfirst,2\n\nsecond,4\n'), {
    rowCount: 2,
    means: { count: 3 }
  });
});
