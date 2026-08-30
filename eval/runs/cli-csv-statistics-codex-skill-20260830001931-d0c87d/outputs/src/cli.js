#!/usr/bin/env node
'use strict';

const fs = require('fs');

const VERSION = '1.0.0';

function usage() {
  return `Usage: csv-stats <csv-path>

Read a CSV file and write JSON containing its row count and numeric-column means.

Options:
  -h, --help       Show this help text
  -v, --version    Show the version

The JSON result is written to stdout; errors are written to stderr.
`;
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field.length === 0) {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some(value => value !== '')) rows.push(row);
  }
  return rows;
}

function analyze(input) {
  const rows = parseCsv(input.replace(/^\uFEFF/, ''));
  if (rows.length === 0) throw new Error('CSV is empty and must include a header row');

  const headers = rows[0];
  if (headers.length === 0 || headers.some(header => header.trim() === '')) {
    throw new Error('CSV header contains an empty column name');
  }
  if (new Set(headers).size !== headers.length) throw new Error('CSV header contains duplicate column names');

  const means = {};
  headers.forEach((header, column) => {
    const values = rows.slice(1).map(row => (row[column] === undefined ? '' : row[column].trim()));
    const numeric = values.filter(value => value !== '').map(Number);
    if (numeric.length > 0 && numeric.length === values.filter(value => value !== '').length && numeric.every(Number.isFinite)) {
      means[header] = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
    }
  });
  return { rowCount: rows.length - 1, means };
}

function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  if (args.includes('--version') || args.includes('-v')) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (args.length !== 1 || args[0].startsWith('-')) {
    process.stderr.write(`Error: provide exactly one CSV path.\n\n${usage()}`);
    return 2;
  }
  try {
    const result = analyze(fs.readFileSync(args[0], 'utf8'));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { analyze, parseCsv, main };
