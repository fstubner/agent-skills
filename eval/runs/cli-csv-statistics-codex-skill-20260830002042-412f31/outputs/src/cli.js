#!/usr/bin/env node
'use strict';

const fs = require('fs');

const VERSION = '1.0.0';

function usage() {
  return `Usage: csv-stats <file.csv>

Read a CSV file and write JSON statistics to stdout.

Options:
  -h, --help       Show this help message
  -v, --version    Show the version

The first row is treated as the header. Numeric columns are those with at
least one numeric value and no non-empty, non-numeric values; blank values are
excluded from their mean.
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
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

function calculate(input) {
  const rows = parseCsv(input);
  if (rows.length === 0) throw new Error('CSV is empty; provide a header row');
  const headers = rows[0].map((header, index) => index === 0 ? header.replace(/^\uFEFF/, '') : header);
  const data = rows.slice(1);
  const result = { rowCount: data.length };

  for (let column = 0; column < headers.length; column += 1) {
    const values = data.map(row => row[column] === undefined ? '' : row[column].trim());
    const numbers = values.filter(value => value !== '').map(Number);
    if (numbers.length > 0 && numbers.every(Number.isFinite) && values.every(value => value === '' || Number.isFinite(Number(value)))) {
      result[headers[column]] = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    }
  }
  return result;
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
    process.stderr.write('Error: provide exactly one CSV path. Use --help for usage.\n');
    return 2;
  }
  try {
    const output = calculate(fs.readFileSync(args[0], 'utf8'));
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { calculate, main, parseCsv };
