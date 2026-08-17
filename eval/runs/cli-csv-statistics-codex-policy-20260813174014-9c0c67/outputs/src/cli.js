#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('unterminated quoted field');
  if (field !== '' || row.length > 0 || input.endsWith(',')) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function summarizeCsv(input) {
  const rows = parseCsv(input);
  if (rows.length === 0) return { rowCount: 0, means: {} };

  const headers = rows[0].map((header) => header.trim());
  if (headers.some((header) => header === '')) throw new Error('CSV header contains an empty column name');
  const sums = headers.map(() => 0);
  const counts = headers.map(() => 0);

  for (const values of rows.slice(1)) {
    if (values.length !== headers.length) throw new Error('row has a different number of columns than the header');
    values.forEach((value, index) => {
      const trimmed = value.trim();
      if (trimmed === '') return;
      const number = Number(trimmed);
      if (Number.isFinite(number)) {
        sums[index] += number;
        counts[index] += 1;
      } else {
        counts[index] = -1;
      }
    });
  }

  const means = {};
  headers.forEach((header, index) => {
    if (counts[index] > 0 && rows.slice(1).every((values) => {
      const value = values[index].trim();
      return value === '' || Number.isFinite(Number(value));
    })) means[header] = sums[index] / counts[index];
  });
  return { rowCount: rows.length - 1, means };
}

function main(argv) {
  if (argv.length !== 3) throw new Error('usage: node src/cli.js <csv-path>');
  const result = summarizeCsv(fs.readFileSync(argv[2], 'utf8').replace(/^\uFEFF/, ''));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  try { main(process.argv); } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseCsv, summarizeCsv };
