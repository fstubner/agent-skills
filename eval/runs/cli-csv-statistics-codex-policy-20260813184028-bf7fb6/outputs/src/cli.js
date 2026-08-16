#!/usr/bin/env node
'use strict';

const fs = require('fs');

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
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('unterminated quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((value) => value !== '')) rows.push(row);
  }
  return rows;
}

function summarizeCsv(input) {
  const rows = parseCsv(input);
  if (rows.length === 0) return { rowCount: 0, means: {} };

  const headers = rows[0];
  if (headers.length === 0 || headers.some((header) => header.trim() === '')) {
    throw new Error('CSV header contains an empty column name');
  }
  const data = rows.slice(1);
  if (data.some((row) => row.length !== headers.length)) {
    throw new Error('CSV row has a different number of columns than the header');
  }

  const means = {};
  headers.forEach((header, column) => {
    const values = data.map((row) => row[column].trim()).filter((value) => value !== '');
    if (values.length === 0 || values.every((value) => Number.isFinite(Number(value)))) {
      if (values.length > 0) {
        means[header] = values.reduce((sum, value) => sum + Number(value), 0) / values.length;
      }
    }
  });
  return { rowCount: data.length, means };
}

function main(args) {
  if (args.length !== 1) throw new Error('usage: node src/cli.js <csv-path>');
  const result = summarizeCsv(fs.readFileSync(args[0], 'utf8'));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseCsv, summarizeCsv };
