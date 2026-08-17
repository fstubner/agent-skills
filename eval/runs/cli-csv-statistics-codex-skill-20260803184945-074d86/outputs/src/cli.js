#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const VERSION = '1.0.0';

function usage() {
  return `Usage: node src/cli.js <csv-path>

Read a CSV file and write JSON with its row count and means of numeric columns.

Options:
  --help       Show this help text.
  --version    Show the version.
`;
}

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
        if (input[i + 1] === '"') { field += '"'; i += 1; }
        else { quoted = false; afterQuote = true; }
      } else field += char;
    } else if (afterQuote) {
      if (char === ' ' || char === '\t') continue;
      if (char === ',') { row.push(field); field = ''; afterQuote = false; }
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && input[i + 1] === '\n') i += 1;
        row.push(field); rows.push(row); row = []; field = ''; afterQuote = false;
      } else throw new Error('invalid CSV: unexpected characters after a quoted field');
    } else if (char === '"' && field === '') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('invalid CSV: unterminated quoted field');
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function analyze(input) {
  const rows = parseCsv(input.replace(/^\uFEFF/, ''));
  if (rows.length === 0) return { rowCount: 0, means: {} };
  const headers = rows[0];
  const data = rows.slice(1);
  const means = {};
  headers.forEach((header, column) => {
    const values = data.map((r) => (r[column] ?? '').trim());
    if (values.length > 0 && values.every((value) => value !== '' && Number.isFinite(Number(value)))) {
      means[header] = values.reduce((sum, value) => sum + Number(value), 0) / values.length;
    }
  });
  return { rowCount: data.length, means };
}

function main(args) {
  if (args.includes('--help')) { process.stdout.write(usage()); return 0; }
  if (args.includes('--version')) { process.stdout.write(`${VERSION}\n`); return 0; }
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
