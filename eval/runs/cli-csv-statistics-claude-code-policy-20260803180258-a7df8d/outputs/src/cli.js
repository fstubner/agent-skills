#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseCSV(content) {
  const lines = content.trim().split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return headers.reduce((obj, header, idx) => {
      obj[header] = values[idx] || '';
      return obj;
    }, {});
  });

  return { headers, rows };
}

function isNumeric(value) {
  if (value === '' || value === null || value === undefined) {
    return false;
  }
  const num = Number(value);
  return !isNaN(num) && value !== '';
}

function calculateMeans(headers, rows) {
  if (rows.length === 0) {
    return {};
  }

  const means = {};

  headers.forEach(header => {
    const values = rows.map(row => row[header]);

    // Check if this column has at least one numeric value
    const numericValues = values.filter(isNumeric).map(Number);

    if (numericValues.length > 0) {
      // Calculate mean from all numeric values in the column
      const sum = numericValues.reduce((acc, val) => acc + val, 0);
      means[header] = sum / numericValues.length;
    }
  });

  return means;
}

function main() {
  if (process.argv.length < 3) {
    console.error('Usage: cli.js <csv-path>');
    process.exit(1);
  }

  const csvPath = process.argv[2];

  let content;
  try {
    content = fs.readFileSync(csvPath, 'utf8');
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }

  const { headers, rows } = parseCSV(content);
  const means = calculateMeans(headers, rows);

  const result = {
    rowCount: rows.length,
    ...means
  };

  console.log(JSON.stringify(result));
}

main();
