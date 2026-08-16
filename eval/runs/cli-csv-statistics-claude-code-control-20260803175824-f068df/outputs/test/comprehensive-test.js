#!/usr/bin/env node

const { parseCSV, isNumeric, analyzeCSV } = require('../src/cli.js');
const fs = require('fs');
const path = require('path');

console.log('=== Comprehensive Integration Test ===\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    testsFailed++;
  }
}

// Test CSV parsing with various formats
test('Parse basic CSV', () => {
  const csv = 'a,b\n1,2\n3,4';
  const { headers, rows } = parseCSV(csv);
  if (headers.length !== 2 || rows.length !== 2) throw new Error('Parse failed');
});

test('Parse CSV with whitespace', () => {
  const csv = 'a , b \n 1 , 2 \n 3 , 4 ';
  const { headers, rows } = parseCSV(csv);
  if (headers[0] !== 'a' || headers[1] !== 'b') throw new Error('Whitespace trimming failed');
  if (rows[0].a !== '1' || rows[0].b !== '2') throw new Error('Value trimming failed');
});

test('Parse CSV with empty lines', () => {
  const csv = 'a,b\n1,2\n\n3,4\n';
  const { headers, rows } = parseCSV(csv);
  if (rows.length !== 2) throw new Error('Empty line handling failed');
});

test('Parse CSV with CRLF line endings', () => {
  const csv = 'a,b\r\n1,2\r\n3,4';
  const { headers, rows } = parseCSV(csv);
  if (rows.length !== 2) throw new Error('CRLF handling failed');
});

// Test numeric detection
test('Detect positive integers', () => {
  if (!isNumeric('123')) throw new Error('Failed to detect positive integer');
});

test('Detect negative numbers', () => {
  if (!isNumeric('-456.78')) throw new Error('Failed to detect negative number');
});

test('Detect scientific notation', () => {
  if (!isNumeric('1e5')) throw new Error('Failed to detect scientific notation');
});

test('Reject empty string', () => {
  if (isNumeric('')) throw new Error('Incorrectly detected empty string as numeric');
});

test('Reject NaN', () => {
  if (isNumeric('NaN') || isNumeric('Infinity')) throw new Error('Incorrectly detected NaN/Infinity');
});

test('Reject text', () => {
  if (isNumeric('abc') || isNumeric('12abc')) throw new Error('Incorrectly detected text as numeric');
});

// Test CSV analysis with real data
test('Analyze simple numeric column', () => {
  const testFile = path.join(__dirname, 'comp-test-1.csv');
  fs.writeFileSync(testFile, 'x\n10\n20\n30');
  const result = analyzeCSV(testFile);
  if (result.rowCount !== 3 || result.x !== 20) throw new Error('Analysis failed');
  fs.unlinkSync(testFile);
});

test('Analyze multiple numeric columns', () => {
  const testFile = path.join(__dirname, 'comp-test-2.csv');
  fs.writeFileSync(testFile, 'a,b,c\n1,10,100\n2,20,200\n3,30,300');
  const result = analyzeCSV(testFile);
  if (result.a !== 2 || result.b !== 20 || result.c !== 200) throw new Error('Multi-column analysis failed');
  fs.unlinkSync(testFile);
});

test('Skip non-numeric columns', () => {
  const testFile = path.join(__dirname, 'comp-test-3.csv');
  fs.writeFileSync(testFile, 'id,name,age\n1,Alice,25\n2,Bob,30');
  const result = analyzeCSV(testFile);
  if (result.name !== undefined) throw new Error('Should not analyze non-numeric column');
  if (result.id !== 1.5 || result.age !== 27.5) throw new Error('Numeric analysis incorrect');
  fs.unlinkSync(testFile);
});

test('Handle partial numeric columns', () => {
  const testFile = path.join(__dirname, 'comp-test-4.csv');
  fs.writeFileSync(testFile, 'data\n10\nabc\n20');
  const result = analyzeCSV(testFile);
  if (result.data !== 15) throw new Error('Partial numeric column analysis failed');
  fs.unlinkSync(testFile);
});

test('Handle single row', () => {
  const testFile = path.join(__dirname, 'comp-test-5.csv');
  fs.writeFileSync(testFile, 'x,y\n5,10');
  const result = analyzeCSV(testFile);
  if (result.rowCount !== 1 || result.x !== 5 || result.y !== 10) throw new Error('Single row analysis failed');
  fs.unlinkSync(testFile);
});

test('Handle empty CSV', () => {
  const testFile = path.join(__dirname, 'comp-test-6.csv');
  fs.writeFileSync(testFile, '');
  const result = analyzeCSV(testFile);
  if (result.rowCount !== 0) throw new Error('Empty CSV handling failed');
  fs.unlinkSync(testFile);
});

test('Handle sample.csv correctly', () => {
  const samplePath = path.join(__dirname, '..', 'sample.csv');
  if (!fs.existsSync(samplePath)) throw new Error('sample.csv not found');
  const result = analyzeCSV(samplePath);
  if (result.rowCount !== 3) throw new Error('Sample rowCount incorrect');
  if (result.incidents !== 4) throw new Error('Sample incidents mean incorrect');
  if (result.response_minutes !== 15) throw new Error('Sample response_minutes mean incorrect');
  if (result.team !== undefined) throw new Error('Sample team should not have mean');
});

console.log(`\n=== Summary ===`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Total: ${testsPassed + testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
}
console.log('\n✓ All tests passed!');
