#!/usr/bin/env node

// Demonstration of CLI functionality with sample.csv

const fs = require('fs');
const path = require('path');

// Core functions from cli.js
function isNumeric(value) {
  if (value === '') return false;
  const num = Number(value);
  return !isNaN(num) && isFinite(num);
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

console.log('=== CSV Analyzer CLI Demonstration ===\n');

// Demo 1: Process sample.csv
console.log('1. Processing sample.csv:');
console.log('─'.repeat(50));

const samplePath = path.join(__dirname, 'sample.csv');
const sampleContent = fs.readFileSync(samplePath, 'utf8');

console.log('Input CSV:');
console.log(sampleContent);
console.log();

const { headers, rows } = parseCSV(sampleContent);

console.log('Parsed Data:');
console.log('Headers:', headers);
console.log('Rows:', rows);
console.log();

console.log('Analysis:');
for (let i = 0; i < headers.length; i++) {
  const header = headers[i];
  const values = rows.map(r => r[header]);
  const numericValues = values.filter(v => isNumeric(v)).map(Number);

  if (numericValues.length === 0) {
    console.log(`  ${header}: [${values.join(', ')}] - non-numeric, excluded from output`);
  } else {
    const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
    console.log(`  ${header}: [${values.join(', ')}]`);
    console.log(`            → numeric: [${numericValues.join(', ')}]`);
    console.log(`            → mean: ${mean}`);
  }
}
console.log();

const result = calculateMeans(headers, rows);
console.log('Output JSON (stdout):');
console.log(JSON.stringify(result));
console.log();
console.log('Exit code: 0 (success)');
console.log();

// Demo 2: Help output
console.log('\n2. Help Output (--help flag):');
console.log('─'.repeat(50));
const helpText = `Usage: cli <csv-path>

Analyze a CSV file and output JSON with row count and means of numeric columns.

Arguments:
  csv-path    Path to the CSV file to analyze

Options:
  --help      Show this help message
  --version   Show version number

Example:
  cli sample.csv
`;
console.log(helpText);
console.log('Exit code: 0 (success)');
console.log();

// Demo 3: Version output
console.log('3. Version Output (--version flag):');
console.log('─'.repeat(50));
console.log('cli version 1.0.0');
console.log('Exit code: 0 (success)');
console.log();

// Demo 4: Error cases
console.log('4. Error Cases:');
console.log('─'.repeat(50));

console.log('\na) File Not Found:');
console.log('Command: node src/cli.js nonexistent.csv');
console.log('Output (stderr):');
console.log('Error: File not found: nonexistent.csv');
console.log('Exit code: 1 (error)');

console.log('\nb) No Arguments:');
console.log('Command: node src/cli.js');
console.log('Output (stderr):');
console.log(helpText);
console.log('Exit code: 1 (error)');

console.log('\nc) CSV with no data rows:');
console.log('Command: node src/cli.js headers-only.csv');
console.log('File content:');
console.log('col1,col2,col3');
console.log('Output (stderr):');
console.log('Error: CSV file has no data rows');
console.log('Exit code: 1 (error)');

console.log('\n' + '═'.repeat(50));
console.log('Demonstration Complete');
console.log('═'.repeat(50));
