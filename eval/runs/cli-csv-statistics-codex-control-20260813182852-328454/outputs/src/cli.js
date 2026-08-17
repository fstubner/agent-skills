#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let justClosedQuote = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
          justClosedQuote = true;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field.length === 0) {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
      justClosedQuote = false;
    } else if (ch === '\n' || ch === '\r') {
      if (justClosedQuote && ch !== '\n' && text[i + 1] === '\n') i += 1;
      else if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
      justClosedQuote = false;
    } else if (justClosedQuote && !/\s/.test(ch)) {
      throw new Error('Invalid CSV: characters found after a closing quote');
    } else if (!justClosedQuote || /\s/.test(ch)) {
      field += ch;
    }
  }

  if (quoted) throw new Error('Invalid CSV: unterminated quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some(value => value !== '')) rows.push(row);
  }
  return rows;
}

function summarize(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { rowCount: 0, means: {} };

  const headers = rows[0];
  const data = rows.slice(1);
  const means = {};
  for (let column = 0; column < headers.length; column += 1) {
    const values = data.map(row => row[column] === undefined ? '' : row[column].trim());
    const present = values.filter(value => value !== '');
    if (present.length === 0 || !present.every(value =>
      value !== '' && Number.isFinite(Number(value)))) continue;
    means[headers[column]] = present.reduce((sum, value) => sum + Number(value), 0) / present.length;
  }
  return { rowCount: data.length, means };
}

function main(argv) {
  if (argv.length !== 1) {
    throw new Error('Usage: node src/cli.js <csv-path>');
  }
  const result = summarize(fs.readFileSync(argv[0], 'utf8'));
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

module.exports = { parseCsv, summarize };
