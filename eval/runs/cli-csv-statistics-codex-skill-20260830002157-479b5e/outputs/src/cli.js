#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const VERSION = '1.0.0';

function usage() {
  return `Usage: node src/cli.js <file.csv>

Read a CSV file and write JSON containing its row count and means for numeric columns.

Options:
  -h, --help       Show this help text
  -v, --version    Show the version

Use -- before the path if it starts with a dash.`;
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;

  for (let i = 0; i < input.length; i += 1) {
    const character = input[i];
    if (quoted) {
      if (character === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
    } else if (afterQuote) {
      if (character === ' ' || character === '\t') continue;
      if (character === ',') {
        row.push(field);
        field = '';
        afterQuote = false;
      } else if (character === '\r' || character === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        afterQuote = false;
        if (character === '\r' && input[i + 1] === '\n') i += 1;
      } else {
        throw new Error(`invalid character after closing quote at position ${i}`);
      }
    } else if (character === '"' && field === '') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\r' || character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (character === '\r' && input[i + 1] === '\n') i += 1;
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('unterminated quoted field');
  if (field !== '' || row.length > 0 || input.endsWith(',')) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((values) => !(values.length === 1 && values[0] === ''));
}

function analyze(input) {
  const rows = parseCsv(input.replace(/^\uFEFF/, ''));
  if (rows.length === 0) throw new Error('CSV file is empty and must include a header row');
  const headers = rows[0];
  if (headers.length === 0 || headers.some((header) => header.trim() === '')) {
    throw new Error('CSV header contains an empty column name');
  }
  for (const values of rows.slice(1)) {
    if (values.length !== headers.length) throw new Error('CSV row has a different number of columns than the header');
  }
  const means = {};
  headers.forEach((header, column) => {
    const values = rows.slice(1).map((row) => row[column].trim());
    if (values.length > 0 && values.every((value) => value !== '' && Number.isFinite(Number(value)))) {
      means[header] = values.reduce((sum, value) => sum + Number(value), 0) / values.length;
    }
  });
  return { rowCount: rows.length - 1, means };
}

function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    if (args.length !== 1) throw new Error('options cannot be combined with a CSV path');
    console.log(usage());
    return;
  }
  if (args.includes('--version') || args.includes('-v')) {
    if (args.length !== 1) throw new Error('options cannot be combined with a CSV path');
    console.log(VERSION);
    return;
  }
  const positional = args[0] === '--' ? args.slice(1) : args;
  if (positional.length !== 1) throw new Error('expected exactly one CSV path; use --help for usage');
  let input;
  try { input = fs.readFileSync(positional[0], 'utf8'); }
  catch (error) { throw new Error(`cannot read ${positional[0]}: ${error.message}`); }
  console.log(JSON.stringify(analyze(input)));
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`Error: ${error.message}`); process.exitCode = 1; }
}

module.exports = { analyze, parseCsv };
