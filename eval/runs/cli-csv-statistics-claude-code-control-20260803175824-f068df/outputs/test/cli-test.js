const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

console.log('=== Testing CLI Invocation ===\n');

// Test 1: Running with sample.csv
console.log('Test 1: Running CLI with sample.csv');
const samplePath = path.join(__dirname, '..', 'sample.csv');
const result1 = spawnSync('node', [path.join(__dirname, '..', 'src', 'cli.js'), samplePath]);
const output1 = result1.stdout.toString().trim();
console.log(`Output: ${output1}`);
console.log(`Exit Code: ${result1.status}`);

try {
  const parsed = JSON.parse(output1);
  console.log(`Parsed JSON: ${JSON.stringify(parsed)}`);
  const correct = parsed.rowCount === 3 && parsed.incidents === 4 && parsed.response_minutes === 15;
  console.log(`Result: ${correct ? '✓ PASS' : '✗ FAIL'}\n`);
} catch (e) {
  console.log(`✗ FAIL - Could not parse JSON output\n`);
}

// Test 2: Running with no arguments
console.log('Test 2: Running CLI with no arguments');
const result2 = spawnSync('node', [path.join(__dirname, '..', 'src', 'cli.js')]);
const stderr2 = result2.stderr.toString().trim();
console.log(`Stderr: ${stderr2}`);
console.log(`Exit Code: ${result2.status}`);
console.log(`Result: ${result2.status === 1 ? '✓ PASS (exit code 1)' : '✗ FAIL'}\n`);

// Test 3: Running with non-existent file
console.log('Test 3: Running CLI with non-existent file');
const result3 = spawnSync('node', [path.join(__dirname, '..', 'src', 'cli.js'), 'nonexistent.csv']);
const stderr3 = result3.stderr.toString().trim();
console.log(`Stderr: ${stderr3}`);
console.log(`Exit Code: ${result3.status}`);
console.log(`Result: ${result3.status === 1 && stderr3.includes('not found') ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 4: Create and test a custom CSV file
console.log('Test 4: Testing with a custom CSV file');
const testCsvPath = path.join(__dirname, 'test-cli.csv');
fs.writeFileSync(testCsvPath, 'product,sales,units_sold\nWidget,1000,50\nGadget,2000,100\nTool,1500,75');

const result4 = spawnSync('node', [path.join(__dirname, '..', 'src', 'cli.js'), testCsvPath]);
const output4 = result4.stdout.toString().trim();
console.log(`Output: ${output4}`);
console.log(`Exit Code: ${result4.status}`);

try {
  const parsed = JSON.parse(output4);
  const expectedSales = (1000 + 2000 + 1500) / 3;
  const expectedUnits = (50 + 100 + 75) / 3;
  const correct = parsed.rowCount === 3 &&
                  Math.abs(parsed.sales - expectedSales) < 0.01 &&
                  Math.abs(parsed.units_sold - expectedUnits) < 0.01 &&
                  !parsed.product;
  console.log(`Parsed JSON: ${JSON.stringify(parsed)}`);
  console.log(`Result: ${correct ? '✓ PASS' : '✗ FAIL'}\n`);
} catch (e) {
  console.log(`✗ FAIL - Could not parse JSON output\n`);
}

fs.unlinkSync(testCsvPath);

console.log('=== CLI Tests Complete ===');
