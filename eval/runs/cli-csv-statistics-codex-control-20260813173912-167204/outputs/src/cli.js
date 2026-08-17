#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const character = input[i];

    if (quoted) {
      if (character === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"' && field.trim() === '') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('unterminated quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function calculate(input) {
  const rows = parseCsv(input.replace(/^\uFEFF/, ''))
    .filter((row) => row.some((value) => value.trim() !== ''));

  if (rows.length === 0) return { rowCount: 0, means: {} };

  const headers = rows[0].map((header) => header.trim());
  const data = rows.slice(1);
  const means = {};

  for (let column = 0; column < headers.length; column += 1) {
    const values = data.map((row) => row[column] === undefined ? '' : row[column].trim());
    if (data.length > 0 && values.every((value) => value !== '' && Number.isFinite(Number(value)))) {
      const total = values.reduce((sum, value) => sum + Number(value), 0);
      means[headers[column]] = total / values.length;
    }
  }

  return { rowCount: data.length, means };
}

function main(args) {
  if (args.length !== 1) {
    throw new Error('usage: node src/cli.js <csv-path>');
  }
  const result = calculate(fs.readFileSync(args[0], 'utf8'));
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

module.exports = { calculate, parseCsv };
