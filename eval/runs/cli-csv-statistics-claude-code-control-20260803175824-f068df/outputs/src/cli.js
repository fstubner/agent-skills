#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseCSV(csvContent) {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }

  return { headers, rows };
}

function isNumeric(value) {
  if (value === '' || value === null || value === undefined) {
    return false;
  }
  const num = Number(value);
  return !isNaN(num) && isFinite(num);
}

function analyzeCSV(csvPath) {
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const { headers, rows } = parseCSV(csvContent);

  const result = {
    rowCount: rows.length
  };

  // Identify numeric columns and calculate means
  for (const header of headers) {
    const values = rows.map(row => row[header]);
    const numericValues = values.filter(isNumeric).map(Number);

    if (numericValues.length > 0) {
      const sum = numericValues.reduce((acc, val) => acc + val, 0);
      const mean = sum / numericValues.length;
      result[header] = mean;
    }
  }

  return result;
}

function main() {
  if (process.argv.length < 3) {
    console.error('Usage: node cli.js <csv-path>');
    process.exit(1);
  }

  const csvPath = process.argv[2];

  try {
    if (!fs.existsSync(csvPath)) {
      console.error(`Error: File not found: ${csvPath}`);
      process.exit(1);
    }

    const result = analyzeCSV(csvPath);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseCSV, isNumeric, analyzeCSV };
