'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { parseCsv, summarize } = require('../src/cli');

test('summarizes numeric columns and counts data rows', () => {
  assert.deepEqual(summarize('name,a,b\nx,2,10\ny,4,20\n'), {
    rowCount: 2, a: 3, b: 15,
  });
});

test('handles quoted commas, escaped quotes, blanks, and CRLF', () => {
  assert.deepEqual(parseCsv('\ufefflabel,value,notes\r\n"a,b",1,"say ""hi"""\r\nnext,,ok\r\n'), [
    ['label', 'value', 'notes'], ['a,b', '1', 'say "hi"'], ['next', '', 'ok'],
  ]);
  assert.deepEqual(summarize('label,value\na,1\nb,\nc,5\n'), { rowCount: 3, value: 3 });
});

test('reports no numeric columns for nonnumeric data', () => {
  assert.deepEqual(summarize('name,kind\na,red\nb,blue\n'), { rowCount: 2 });
});
