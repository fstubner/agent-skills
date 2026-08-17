#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += char;
      }
    } else if (afterQuote) {
      if (char === ' ' || char === '\t') continue;
      if (char === ',') {
        row.push(field);
        field = '';
        afterQuote = false;
      } else if (char === '\r' || char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        afterQuote = false;
        if (char === '\r' && input[i + 1] === '\n') i += 1;
      } else {
        throw new Error('Invalid CSV: unexpected characters after a quoted field');
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r' || char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (char === '\r' && input[i + 1] === '\n') i += 1;
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('Invalid CSV: unterminated quoted field');
  if (row.length > 0 || field !== '' || afterQuote) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((item) => !(item.length === 1 && item[0] === ''));
}

function summarizeCsv(input) {
  const rows = parseCsv(input.replace(/^\uFEFF/, ''));
  if (rows.length === 0) return { rowCount: 0 };

  const headers = rows[0];
  if (headers.some((header) => header.trim() === '')) {
    throw new Error('CSV must have non-empty column names');
  }
  const data = rows.slice(1);
  if (data.some((row) => row.length !== headers.length)) {
    throw new Error('Invalid CSV: rows have inconsistent column counts');
  }

  const result = { rowCount: data.length };
  for (let column = 0; column < headers.length; column += 1) {
    const values = data.map((row) => row[column].trim()).filter((value) => value !== '');
    if (values.length === 0 || values.some((value) => !isNumeric(value))) continue;
    result[headers[column]] = values.reduce((sum, value) => sum + Number(value), 0) / values.length;
  }
  return result;
}

function isNumeric(value) {
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value));
}

function main(args = process.argv.slice(2)) {
  if (args.length !== 1) throw new Error('Usage: node src/cli.js <csv-path>');
  const input = fs.readFileSync(args[0], 'utf8');
  process.stdout.write(`${JSON.stringify(summarizeCsv(input))}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseCsv, summarizeCsv, isNumeric };
