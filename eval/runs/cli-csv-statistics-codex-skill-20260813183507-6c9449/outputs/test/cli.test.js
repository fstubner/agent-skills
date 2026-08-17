'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { calculate } = require('../src/cli');

test('calculates row count and means for numeric columns', () => {
  assert.deepStrictEqual(calculate('name,count,minutes\na,3,12\nb,5,18\n'), {
    rowCount: 2, count: 4, minutes: 15
  });
});

test('supports quoted commas, escaped quotes, and newlines', () => {
  assert.deepStrictEqual(calculate('name,value,note\n"A, one",2,"say ""hi"""\n"B\n two",4,x\n'), {
    rowCount: 2, value: 3
  });
});

test('CLI output is JSON and handles missing paths', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'csv-stats-')), 'data.csv');
  fs.writeFileSync(file, 'x,y\n1,not-number\n3,also-not\n');
  assert.deepStrictEqual(calculate(fs.readFileSync(file, 'utf8')), { rowCount: 2, x: 2 });
});
