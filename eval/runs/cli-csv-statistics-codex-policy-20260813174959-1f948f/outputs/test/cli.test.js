'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { parseCsv, summarizeCsv } = require('../src/cli');

test('summarizes numeric columns and counts data rows', () => {
  assert.deepEqual(summarizeCsv('name,a,b\nx,2,10\ny,4,20\n'), {
    rowCount: 2, a: 3, b: 15,
  });
});

test('supports quoted CSV fields, CRLF, and empty numeric cells', () => {
  assert.deepEqual(parseCsv('name,score\r\n"Doe, Jane",2\r\nSmith,\r\n'), [
    ['name', 'score'], ['Doe, Jane', '2'], ['Smith', ''],
  ]);
  assert.deepEqual(summarizeCsv('name,score\nA,2\nB,\n'), { rowCount: 2, score: 2 });
});

test('excludes columns containing non-numeric values', () => {
  assert.deepEqual(summarizeCsv('a,b\n1,yes\n2,no\n'), { rowCount: 2, a: 1.5 });
});

test('rejects malformed or uneven CSV', () => {
  assert.throws(() => summarizeCsv('a,b\n"unterminated,2\n'), /unterminated/);
  assert.throws(() => summarizeCsv('a,b\n1\n'), /inconsistent/);
});
