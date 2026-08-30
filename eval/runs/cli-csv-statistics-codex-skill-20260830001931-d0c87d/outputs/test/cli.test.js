'use strict';

const assert = require('assert');
const test = require('node:test');
const { analyze } = require('../src/cli');

test('counts rows and averages numeric columns', () => {
  assert.deepStrictEqual(analyze('name,count,score\na,2,10\nb,4,20\n'), {
    rowCount: 2,
    means: { count: 3, score: 15 },
  });
});

test('handles quoted commas, escaped quotes, and multiline fields', () => {
  assert.deepStrictEqual(analyze('label,value\n"a, one",1\n"say ""hi""\nthere",3'), {
    rowCount: 2,
    means: { value: 2 },
  });
});

test('ignores blank numeric values when calculating a mean', () => {
  assert.deepStrictEqual(analyze('a,b\n1,\n3,5\n'), { rowCount: 2, means: { a: 2, b: 5 } });
});
