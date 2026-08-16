#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const VERSION = '1.0.0';

function usage() {
  return `Usage: node src/cli.js <input.csv>

Read a CSV file and write JSON containing rowCount and means for numeric columns.

Options:
  -h, --help       Show this help text
  -v, --version    Show the version
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
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some(value => value !== '')) rows.push(row);
  }
  return rows;
}

function analyze(input) {
  const rows = parseCsv(input);
  if (rows.length === 0) throw new Error('CSV is empty; expected a header row');
  const headers = rows[0];
  if (headers.length === 0 || headers.some(header => header === '')) {
    throw new Error('CSV header contains an empty column name');
  }
  if (new Set(headers).size !== headers.length) throw new Error('CSV header contains duplicate column names');

  const data = rows.slice(1);
  for (const values of data) {
    if (values.length !== headers.length) throw new Error(`CSV row has ${values.length} columns; expected ${headers.length}`);
  }

  const means = {};
  headers.forEach((header, index) => {
    const values = data.map(row => row[index]).filter(value => value.trim() !== '');
    if (values.length === 0 || !values.every(value => Number.isFinite(Number(value.trim())))) return;
    means[header] = values.reduce((sum, value) => sum + Number(value.trim()), 0) / values.length;
  });
  return { rowCount: data.length, means };
}

function main(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    if (argv.length !== 1) throw new Error('options cannot be combined with a file path');
    process.stdout.write(usage());
    return;
  }
  if (argv.includes('-v') || argv.includes('--version')) {
    if (argv.length !== 1) throw new Error('options cannot be combined with a file path');
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (argv.length !== 1) throw new Error('expected exactly one CSV path (try --help)');
  let input;
  try { input = fs.readFileSync(argv[0], 'utf8'); }
  catch (error) { throw new Error(`cannot read '${argv[0]}': ${error.message}`); }
  process.stdout.write(`${JSON.stringify(analyze(input))}\n`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`Error: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { analyze, parseCsv };
