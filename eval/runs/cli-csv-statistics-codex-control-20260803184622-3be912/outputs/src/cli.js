#!/usr/bin/env node
'use strict';

const fs = require('fs');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function summarize(csv) {
  const rows = parseCsv(csv).filter(row => row.some(value => value.trim() !== ''));
  if (rows.length === 0) return { rowCount: 0 };
  const headers = rows[0];
  const sums = headers.map(() => 0);
  const counts = headers.map(() => 0);
  for (const row of rows.slice(1)) {
    for (let i = 0; i < headers.length; i += 1) {
      const value = row[i] === undefined ? '' : row[i].trim();
      if (value !== '' && Number.isFinite(Number(value))) { sums[i] += Number(value); counts[i] += 1; }
    }
  }
  const means = {};
  for (let i = 0; i < headers.length; i += 1) {
    if (counts[i] > 0) means[headers[i]] = sums[i] / counts[i];
  }
  return { rowCount: rows.length - 1, means };
}

function main() {
  const file = process.argv[2];
  if (!file || process.argv.length !== 3) {
    console.error('Usage: node src/cli.js <csv-path>');
    process.exitCode = 2;
    return;
  }
  try {
    process.stdout.write(`${JSON.stringify(summarize(fs.readFileSync(file, 'utf8')))}\n`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { parseCsv, summarize };
