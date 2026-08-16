#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const VERSION = '1.0.0';

function printHelp() {
  console.error(`Usage: cli <csv-path>

Analyze a CSV file and output JSON with row count and means of numeric columns.

Arguments:
  csv-path    Path to the CSV file to analyze

Options:
  --help      Show this help message
  --version   Show version number

Example:
  cli sample.csv
`);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    process.exit(1);
  }

  if (args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  if (args[0] === '--version' || args[0] === '-v') {
    console.log(`cli version ${VERSION}`);
    process.exit(0);
  }

  if (args[0].startsWith('-')) {
    console.error(`Error: Unknown option "${args[0]}"`);
    console.error('Run "cli --help" for usage information.');
    process.exit(1);
  }

  return args[0];
}

function parseCSV(content) {
  const lines = content.trim().split('\n');

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());
    const row = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }

    rows.push(row);
  }

  return { headers, rows };
}

function isNumeric(value) {
  if (value === '') return false;
  const num = Number(value);
  return !isNaN(num) && isFinite(num);
}

function calculateMeans(headers, rows) {
  const result = {
    rowCount: rows.length
  };

  for (const header of headers) {
    const values = rows
      .map(row => row[header])
      .filter(v => isNumeric(v))
      .map(v => Number(v));

    if (values.length > 0) {
      const sum = values.reduce((acc, val) => acc + val, 0);
      const mean = sum / values.length;
      result[header] = mean;
    }
  }

  return result;
}

async function main() {
  try {
    const csvPath = parseArgs();

    if (!fs.existsSync(csvPath)) {
      console.error(`Error: File not found: ${csvPath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const { headers, rows } = parseCSV(content);

    if (rows.length === 0) {
      console.error('Error: CSV file has no data rows');
      process.exit(1);
    }

    const result = calculateMeans(headers, rows);
    console.log(JSON.stringify(result));
    process.exit(0);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
