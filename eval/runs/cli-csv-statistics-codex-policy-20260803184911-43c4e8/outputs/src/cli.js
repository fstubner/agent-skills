#!/usr/bin/env node
'use strict';

const fs = require('fs');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field.length === 0) quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (quoted) throw new Error('Unclosed quoted field');
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

function analyzeCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error('CSV is empty');
  const headers = rows[0].map(h => h.trim());
  if (headers.some(h => !h)) throw new Error('CSV contains an empty header');
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate headers');
  const data = rows.slice(1);
  if (data.some(r => r.length !== headers.length)) throw new Error('CSV row has the wrong number of columns');
  const result = { rowCount: data.length };
  headers.forEach((header, index) => {
    const values = data.map(r => r[index].trim());
    if (values.length && values.every(v => v !== '' && Number.isFinite(Number(v)))) {
      result[header] = values.reduce((sum, v) => sum + Number(v), 0) / values.length;
    }
  });
  return result;
}

function main(argv) {
  if (argv.length !== 1) throw new Error('Usage: node src/cli.js <csv-path>');
  const text = fs.readFileSync(argv[0], 'utf8').replace(/^\uFEFF/, '');
  process.stdout.write(`${JSON.stringify(analyzeCsv(text))}\n`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`Error: ${error.message}`); process.exitCode = 1; }
}

module.exports = { analyzeCsv, parseCsv };
