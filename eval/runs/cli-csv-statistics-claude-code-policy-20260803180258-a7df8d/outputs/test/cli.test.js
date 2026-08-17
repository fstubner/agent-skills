const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function runCLI(csvPath) {
  try {
    const result = execSync(`node src/cli.js ${csvPath}`, { encoding: 'utf8' });
    return JSON.parse(result);
  } catch (err) {
    throw new Error(`CLI failed: ${err.message}`);
  }
}

function writeTempCSV(filename, content) {
  const filePath = path.join(__dirname, '..', filename);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function cleanup(...filenames) {
  filenames.forEach(filename => {
    const filePath = path.join(__dirname, '..', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
}

console.log('Running CLI tests...\n');

// Test 1: Sample CSV
console.log('Test 1: Sample CSV with numeric columns');
const result1 = runCLI('sample.csv');
console.log('Result:', JSON.stringify(result1));
if (result1.rowCount !== 3) {
  throw new Error(`Expected rowCount 3, got ${result1.rowCount}`);
}
if (result1.incidents !== 4) {
  throw new Error(`Expected incidents mean 4, got ${result1.incidents}`);
}
if (result1.response_minutes !== 15) {
  throw new Error(`Expected response_minutes mean 15, got ${result1.response_minutes}`);
}
console.log('✓ Passed\n');

// Test 2: Single numeric column
console.log('Test 2: Single numeric column');
const csv2 = writeTempCSV('test2.csv', 'value\n10\n20\n30');
const result2 = runCLI('test2.csv');
console.log('Result:', JSON.stringify(result2));
if (result2.rowCount !== 3) {
  throw new Error(`Expected rowCount 3, got ${result2.rowCount}`);
}
if (result2.value !== 20) {
  throw new Error(`Expected value mean 20, got ${result2.value}`);
}
cleanup('test2.csv');
console.log('✓ Passed\n');

// Test 3: Mixed numeric and text columns
console.log('Test 3: Mixed numeric and text columns');
const csv3 = writeTempCSV('test3.csv', 'name,score\nalice,90\nbob,85\ncharlie,95');
const result3 = runCLI('test3.csv');
console.log('Result:', JSON.stringify(result3));
if (result3.rowCount !== 3) {
  throw new Error(`Expected rowCount 3, got ${result3.rowCount}`);
}
if (!('name' in result3)) {
  throw new Error('Expected no mean for non-numeric column "name"');
}
if (result3.score !== 90) {
  throw new Error(`Expected score mean 90, got ${result3.score}`);
}
cleanup('test3.csv');
console.log('✓ Passed\n');

// Test 4: Empty rows / sparse data
console.log('Test 4: Sparse data with missing values');
const csv4 = writeTempCSV('test4.csv', 'name,value\nalice,10\nbob,\ncharlie,20');
const result4 = runCLI('test4.csv');
console.log('Result:', JSON.stringify(result4));
if (result4.rowCount !== 3) {
  throw new Error(`Expected rowCount 3, got ${result4.rowCount}`);
}
if (result4.value !== 15) {
  throw new Error(`Expected value mean 15 (ignoring empty), got ${result4.value}`);
}
cleanup('test4.csv');
console.log('✓ Passed\n');

// Test 5: Only headers (no data rows)
console.log('Test 5: Only headers, no data rows');
const csv5 = writeTempCSV('test5.csv', 'col1,col2,col3');
const result5 = runCLI('test5.csv');
console.log('Result:', JSON.stringify(result5));
if (result5.rowCount !== 0) {
  throw new Error(`Expected rowCount 0, got ${result5.rowCount}`);
}
cleanup('test5.csv');
console.log('✓ Passed\n');

// Test 6: Floats and negative numbers
console.log('Test 6: Floats and negative numbers');
const csv6 = writeTempCSV('test6.csv', 'metric\n1.5\n-2.5\n3.0');
const result6 = runCLI('test6.csv');
console.log('Result:', JSON.stringify(result6));
if (result6.rowCount !== 3) {
  throw new Error(`Expected rowCount 3, got ${result6.rowCount}`);
}
if (Math.abs(result6.metric - 0.6666666666666666) > 0.0001) {
  throw new Error(`Expected metric mean ~0.667, got ${result6.metric}`);
}
cleanup('test6.csv');
console.log('✓ Passed\n');

// Test 7: All non-numeric column
console.log('Test 7: All non-numeric column');
const csv7 = writeTempCSV('test7.csv', 'status\nactive\ninactive\npending');
const result7 = runCLI('test7.csv');
console.log('Result:', JSON.stringify(result7));
if (result7.rowCount !== 3) {
  throw new Error(`Expected rowCount 3, got ${result7.rowCount}`);
}
if ('status' in result7) {
  throw new Error('Expected no mean for all non-numeric column "status"');
}
cleanup('test7.csv');
console.log('✓ Passed\n');

// Test 8: File not found error handling
console.log('Test 8: File not found error handling');
try {
  runCLI('nonexistent.csv');
  throw new Error('Expected error for nonexistent file');
} catch (err) {
  if (!err.message.includes('ENOENT') && !err.message.includes('Error reading file')) {
    throw err;
  }
  console.log('✓ Passed (correctly threw error)\n');
}

// Test 9: Multiple numeric columns
console.log('Test 9: Multiple numeric columns');
const csv9 = writeTempCSV('test9.csv', 'x,y,z\n1,2,3\n4,5,6\n7,8,9');
const result9 = runCLI('test9.csv');
console.log('Result:', JSON.stringify(result9));
if (result9.rowCount !== 3) {
  throw new Error(`Expected rowCount 3, got ${result9.rowCount}`);
}
if (result9.x !== 4) {
  throw new Error(`Expected x mean 4, got ${result9.x}`);
}
if (result9.y !== 5) {
  throw new Error(`Expected y mean 5, got ${result9.y}`);
}
if (result9.z !== 6) {
  throw new Error(`Expected z mean 6, got ${result9.z}`);
}
cleanup('test9.csv');
console.log('✓ Passed\n');

// Test 10: Whitespace handling
console.log('Test 10: Whitespace handling in values');
const csv10 = writeTempCSV('test10.csv', 'a, b , c\n 1 , 2 , 3 \n4,5,6');
const result10 = runCLI('test10.csv');
console.log('Result:', JSON.stringify(result10));
if (result10.rowCount !== 2) {
  throw new Error(`Expected rowCount 2, got ${result10.rowCount}`);
}
// Headers should be trimmed: 'a', 'b', 'c'
if (result10.a !== 2.5 || result10.b !== 3.5 || result10.c !== 4.5) {
  throw new Error(`Expected trimmed headers and values. Got ${JSON.stringify(result10)}`);
}
cleanup('test10.csv');
console.log('✓ Passed\n');

console.log('All tests passed!');
