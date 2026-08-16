#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const VERSION = '1.0.0';

function usage() {
  return `Usage: csv-stats <csv-path>

Read a CSV file and write JSON statistics to stdout.

Options:
  -h, --help       Show this help text
  -v, --version    Show the program version
`;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false, afterQuote = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else { quoted = false; afterQuote = true; }
      } else field += c;
    } else if (afterQuote) {
      if (c === ' ' || c === '\t') continue;
      if (c === ',') { row.push(field); field = ''; afterQuote = false; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i += 1;
        row.push(field); rows.push(row); row = []; field = ''; afterQuote = false;
      } else throw new Error(`invalid character after closing quote at position ${i}`);
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('unterminated quoted field');
  if (afterQuote || field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

function calculate(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  if (rows.length === 0) throw new Error('CSV file is empty');
  const headers = rows[0].map((h) => h.trim());
  if (headers.some((h) => h === '') || new Set(headers).size !== headers.length) {
    throw new Error('CSV header must contain unique, non-empty column names');
  }
  for (const [index, row] of rows.slice(1).entries()) {
    if (row.length !== headers.length) throw new Error(`row ${index + 2} has ${row.length} fields; expected ${headers.length}`);
  }
  const means = {};
  for (let column = 0; column < headers.length; column += 1) {
    const values = rows.slice(1).map((r) => r[column].trim()).filter((v) => v !== '');
    if (values.length && values.every((v) => Number.isFinite(Number(v)))) {
      means[headers[column]] = values.reduce((sum, v) => sum + Number(v), 0) / values.length;
    }
  }
  return { rowCount: rows.length - 1, means };
}

function main(args) {
  if (args.includes('--help') || args.includes('-h')) { process.stdout.write(usage()); return 0; }
  if (args.includes('--version') || args.includes('-v')) { process.stdout.write(`${VERSION}\n`); return 0; }
  const positional = args[0] === '--' ? args.slice(1) : args;
  if (positional.length !== 1 || (args[0] !== '--' && positional[0].startsWith('-'))) {
    process.stderr.write(`Error: provide exactly one CSV path.\n\n${usage()}`); return 2;
  }
  const file = path.resolve(positional[0]);
  try {
    const result = calculate(fs.readFileSync(file, 'utf8'));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`Error: could not process ${positional[0]}: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { calculate, parseCsv, main };
