#!/usr/bin/env node

// Direct verification of CLI logic without running subprocess

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

function testCase(name, csvContent, expectedKeys) {
  try {
    const { headers, rows } = parseCSV(csvContent);
    const result = calculateMeans(headers, rows);

    const hasAllKeys = expectedKeys.every(key => key in result);
    const resultStr = JSON.stringify(result);

    if (hasAllKeys && result.rowCount === expectedKeys.includes('rowCount')) {
      console.log(`✓ ${name}`);
      console.log(`  Result: ${resultStr}`);
      return true;
    } else {
      console.log(`✗ ${name}`);
      console.log(`  Result: ${resultStr}`);
      console.log(`  Expected keys: ${expectedKeys.join(', ')}`);
      return false;
    }
  } catch (error) {
    console.log(`✗ ${name} - Error: ${error.message}`);
    return false;
  }
}

console.log('Verifying CLI Logic\n');

let passed = 0;
let failed = 0;

// Test 1: Basic numeric columns (from sample.csv)
if (testCase(
  'Test 1: Basic numeric columns',
  `team,incidents,response_minutes
alpha,3,12
beta,5,18
gamma,4,15`,
  ['rowCount', 'incidents', 'response_minutes']
)) {
  const { headers, rows } = parseCSV(`team,incidents,response_minutes
alpha,3,12
beta,5,18
gamma,4,15`);
  const result = calculateMeans(headers, rows);
  if (result.rowCount === 3 && result.incidents === 4 && result.response_minutes === 15) {
    console.log(`  Values verified: rowCount=3, incidents=4, response_minutes=15\n`);
    passed++;
  } else {
    console.log(`  Value check failed: ${JSON.stringify(result)}\n`);
    failed++;
  }
} else {
  failed++;
}

// Test 2: Mixed string and numeric
if (testCase(
  'Test 2: Mixed string and numeric columns',
  `name,age,score
alice,25,85.5
bob,30,92
charlie,22,78.5`,
  ['rowCount', 'age', 'score']
)) {
  const { headers, rows } = parseCSV(`name,age,score
alice,25,85.5
bob,30,92
charlie,22,78.5`);
  const result = calculateMeans(headers, rows);
  if (result.rowCount === 3 && !('name' in result)) {
    console.log(`  Non-numeric column 'name' correctly excluded\n`);
    passed++;
  } else {
    failed++;
  }
} else {
  failed++;
}

// Test 3: Empty values
if (testCase(
  'Test 3: Empty string values',
  `a,b,c
1,,3
4,5,
7,8,9`,
  ['rowCount', 'a', 'b', 'c']
)) {
  const { headers, rows } = parseCSV(`a,b,c
1,,3
4,5,
7,8,9`);
  const result = calculateMeans(headers, rows);
  // a: 1,4,7 → mean 4
  // b: 5,8 → mean 6.5 (skips empty)
  // c: 3,9 → mean 6 (skips empty)
  if (result.a === 4 && result.b === 6.5 && result.c === 6) {
    console.log(`  Empty values correctly skipped in means\n`);
    passed++;
  } else {
    console.log(`  Expected a=4, b=6.5, c=6 but got ${JSON.stringify(result)}\n`);
    failed++;
  }
} else {
  failed++;
}

// Test 4: Negative numbers
if (testCase(
  'Test 4: Negative numbers',
  `value,delta
100,-10
50,-20
200,5`,
  ['rowCount', 'value', 'delta']
)) {
  const { headers, rows } = parseCSV(`value,delta
100,-10
50,-20
200,5`);
  const result = calculateMeans(headers, rows);
  // value: (100+50+200)/3 ≈ 116.67
  // delta: (-10-20+5)/3 ≈ -8.33
  if (Math.abs(result.value - 116.66666666666667) < 0.0001 &&
      Math.abs(result.delta - (-8.333333333333334)) < 0.0001) {
    console.log(`  Negative numbers handled correctly\n`);
    passed++;
  } else {
    console.log(`  Expected value≈116.67, delta≈-8.33 but got ${JSON.stringify(result)}\n`);
    failed++;
  }
} else {
  failed++;
}

// Test 5: Decimal numbers
if (testCase(
  'Test 5: Decimal numbers',
  `x,y
1.5,2.5
2.5,3.5
3.5,4.5`,
  ['rowCount', 'x', 'y']
)) {
  const { headers, rows } = parseCSV(`x,y
1.5,2.5
2.5,3.5
3.5,4.5`);
  const result = calculateMeans(headers, rows);
  if (result.x === 2.5 && result.y === 3.5) {
    console.log(`  Decimal numbers preserved correctly\n`);
    passed++;
  } else {
    failed++;
  }
} else {
  failed++;
}

// Test 6: isNumeric function
console.log('Test 6: isNumeric function');
const numericTests = [
  ['', false],
  ['0', true],
  ['123', true],
  ['-456', true],
  ['3.14', true],
  ['abc', false],
  ['12.34.56', false],
  ['Infinity', false],
  ['NaN', false],
  [' 42 ', true]
];

let numericPassed = true;
for (const [value, expected] of numericTests) {
  const trimmedValue = value.trim();
  const result = isNumeric(trimmedValue);
  if (result !== expected) {
    console.log(`  ✗ isNumeric("${value}") = ${result}, expected ${expected}`);
    numericPassed = false;
  }
}

if (numericPassed) {
  console.log(`  ✓ All isNumeric tests passed\n`);
  passed++;
} else {
  console.log();
  failed++;
}

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
