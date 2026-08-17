#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let atFieldStart = true;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && atFieldStart) {
      quoted = true;
      atFieldStart = false;
    } else if (char === ',') {
      row.push(field);
      field = '';
      atFieldStart = true;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      atFieldStart = true;
    } else {
      field += char;
      atFieldStart = false;
    }
  }
  if (quoted) throw new Error('unterminated quoted field');
  if (field !== '' || row.length > 0 || (text.length > 0 && /[,\n\r]$/.test(text))) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((candidate) => !(candidate.length === 1 && candidate[0] === ''));
}

function isNumber(value) {
  return value.trim() !== '' && Number.isFinite(Number(value));
}

function summarize(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { rowCount: 0 };
  const headers = rows[0];
  const data = rows.slice(1);
  const result = { rowCount: data.length };

  headers.forEach((header, column) => {
    const values = data.map((row) => row[column] === undefined ? '' : row[column].trim());
    const populated = values.filter((value) => value !== '');
    if (populated.length > 0 && populated.every(isNumber)) {
      result[header] = populated.reduce((sum, value) => sum + Number(value), 0) / populated.length;
    }
  });
  return result;
}

function main(args) {
  if (args.length !== 1) {
    throw new Error('usage: node src/cli.js <csv-path>');
  }
  const output = summarize(fs.readFileSync(args[0], 'utf8'));
  process.stdout.write(`${JSON.stringify(output)}\n`);
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
