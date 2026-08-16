'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { parseCsv, summarizeCsv } = require('../src/cli');

test('summarizes numeric columns and ignores empty numeric cells', () => {
  assert.deepEqual(summarizeCsv('name,score,other\na,2,yes\nb,4,\nc,,no\n'), {
    rowCount: 3,
    means: { score: 3 },
  });
});

test('supports quoted commas, escaped quotes, and newlines', () => {
  assert.deepEqual(parseCsv('name,n\n"a,b",1\n"say ""hi""",2\n"line\nbreak",3'), [
    ['name', 'n'], ['a,b', '1'], ['say "hi"', '2'], ['line\nbreak', '3'],
  ]);
});

test('rejects malformed row widths and unterminated quotes', () => {
  assert.throws(() => summarizeCsv('a,b\n1'), /different number/);
  assert.throws(() => parseCsv('a\n"unfinished'), /unterminated/);
});

test('handles a header-only CSV', () => {
  assert.deepEqual(summarizeCsv('a,b\n'), { rowCount: 0, means: {} });
});
