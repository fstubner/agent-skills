#!/usr/bin/env node
'use strict';

const fs = require('fs');

const VERSION = '1.0.0';

function usage() {
  return `Usage: csv-stats <csv-path>

Read a CSV file and write JSON statistics to stdout.

Options:
  -h, --help       Show this help message
  -v, --version    Show the version

The output contains rowCount and the arithmetic mean of each numeric column.
`;
}

function parseCsv(text) {
  const records = [];
  let record = [], field = '', quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += char;
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      record.push(field); field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field); field = '';
      if (record.some(value => value !== '')) records.push(record);
      record = [];
    } else field += char;
  }
  if (quoted) throw new Error('unterminated quoted field');
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    if (record.some(value => value !== '')) records.push(record);
  }
  return records;
}

function calculate(text) {
  const records = parseCsv(text.replace(/^\uFEFF/, ''));
  if (records.length === 0) throw new Error('CSV file is empty');
  const headers = records[0];
  if (headers.length === 0 || headers.some(header => header.trim() === '')) {
    throw new Error('CSV header contains an empty column name');
  }
  const rows = records.slice(1);
  const means = {};
  headers.forEach((header, column) => {
    const values = rows.map(row => row[column] === undefined ? '' : row[column].trim());
    if (values.length > 0 && values.every(value => value !== '' && Number.isFinite(Number(value)))) {
      means[header] = values.reduce((sum, value) => sum + Number(value), 0) / values.length;
    }
  });
  return { rowCount: rows.length, ...means };
}

function main(args) {
  if (args.includes('--help') || args.includes('-h')) { process.stdout.write(usage()); return 0; }
  if (args.includes('--version') || args.includes('-v')) { process.stdout.write(`${VERSION}\n`); return 0; }
  if (args.length !== 1 || args[0].startsWith('-')) {
    process.stderr.write('Error: provide exactly one CSV path. Use --help for usage.\n');
    return 2;
  }
  try {
    const result = calculate(fs.readFileSync(args[0], 'utf8'));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`Error: ${error.message}. Check the CSV path and format, then re-run.\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { calculate, parseCsv, main };
