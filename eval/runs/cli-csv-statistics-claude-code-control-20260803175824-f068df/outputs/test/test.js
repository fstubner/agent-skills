const { parseCSV, isNumeric, analyzeCSV } = require('../src/cli.js');
const fs = require('fs');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`✗ ${message}`);
    testsFailed++;
  }
}

function deepEqual(a, b, message) {
  const equal = JSON.stringify(a) === JSON.stringify(b);
  assert(equal, message);
  if (!equal) {
    console.error(`  Expected: ${JSON.stringify(b)}`);
    console.error(`  Got: ${JSON.stringify(a)}`);
  }
}

function testParseCSV() {
  console.log('\n=== Testing parseCSV ===');

  // Test basic parsing
  const csv1 = 'name,age,score\nAlice,30,85\nBob,25,90';
  const result1 = parseCSV(csv1);
  deepEqual(result1.headers, ['name', 'age', 'score'], 'Should parse headers correctly');
  deepEqual(result1.rows.length, 2, 'Should parse 2 rows');
  deepEqual(result1.rows[0], { name: 'Alice', age: '30', score: '85' }, 'Should parse first row');

  // Test with whitespace
  const csv2 = 'name , age , score\nAlice , 30 , 85\nBob , 25 , 90';
  const result2 = parseCSV(csv2);
  deepEqual(result2.headers, ['name', 'age', 'score'], 'Should trim header whitespace');
  deepEqual(result2.rows[0].age, '30', 'Should trim value whitespace');

  // Test with empty lines
  const csv3 = 'a,b\n1,2\n\n3,4';
  const result3 = parseCSV(csv3);
  deepEqual(result3.rows.length, 2, 'Should skip empty lines');

  // Test single row
  const csv4 = 'x,y\n10,20';
  const result4 = parseCSV(csv4);
  deepEqual(result4.rows.length, 1, 'Should handle single row');

  // Test empty CSV
  const csv5 = '';
  const result5 = parseCSV(csv5);
  deepEqual(result5.rows.length, 0, 'Should handle empty CSV');
}

function testIsNumeric() {
  console.log('\n=== Testing isNumeric ===');

  assert(isNumeric('123'), 'Should recognize integer');
  assert(isNumeric('123.45'), 'Should recognize decimal');
  assert(isNumeric('-50'), 'Should recognize negative number');
  assert(isNumeric('0'), 'Should recognize zero');
  assert(isNumeric('-0.5'), 'Should recognize negative decimal');

  assert(!isNumeric('abc'), 'Should reject text');
  assert(!isNumeric(''), 'Should reject empty string');
  assert(!isNumeric('12abc'), 'Should reject mixed text');
  assert(!isNumeric('NaN'), 'Should reject NaN');
  assert(!isNumeric('Infinity'), 'Should reject Infinity');
  assert(!isNumeric(null), 'Should reject null');
  assert(!isNumeric(undefined), 'Should reject undefined');
}

function testAnalyzeCSV() {
  console.log('\n=== Testing analyzeCSV ===');

  // Create test file 1
  const testFile1 = path.join(__dirname, 'temp1.csv');
  fs.writeFileSync(testFile1, 'name,value1,value2\nAlice,10,20\nBob,20,30\nCharlie,30,40');

  const result1 = analyzeCSV(testFile1);
  deepEqual(result1.rowCount, 3, 'Should count 3 rows');
  assert(result1.value1 === 20, 'Should calculate mean of value1 correctly (20)');
  assert(result1.value2 === 30, 'Should calculate mean of value2 correctly (30)');
  assert(result1.name === undefined, 'Should not calculate mean for non-numeric column');

  fs.unlinkSync(testFile1);

  // Create test file 2 with sample data
  const testFile2 = path.join(__dirname, 'temp2.csv');
  fs.writeFileSync(testFile2, 'team,incidents,response_minutes\nalpha,3,12\nbeta,5,18\ngamma,4,15');

  const result2 = analyzeCSV(testFile2);
  deepEqual(result2.rowCount, 3, 'Sample data: Should count 3 rows');
  assert(result2.incidents === 4, 'Sample data: Mean of incidents should be 4');
  assert(result2.response_minutes === 15, 'Sample data: Mean of response_minutes should be 15');
  assert(result2.team === undefined, 'Sample data: Should not calculate mean for team');

  fs.unlinkSync(testFile2);

  // Create test file 3 with mixed types
  const testFile3 = path.join(__dirname, 'temp3.csv');
  fs.writeFileSync(testFile3, 'id,product,quantity,price\n1,Widget,5,10.5\n2,Gadget,10,15.75\n3,Tool,3,8.25');

  const result3 = analyzeCSV(testFile3);
  deepEqual(result3.rowCount, 3, 'Mixed types: Should count rows');
  assert(result3.id === 2, 'Mixed types: id mean should be 2');
  assert(Math.abs(result3.price - 11.5) < 0.01, 'Mixed types: price mean should be 11.5');
  assert(result3.product === undefined, 'Mixed types: product should not have mean');

  fs.unlinkSync(testFile3);

  // Create test file 4 with single row
  const testFile4 = path.join(__dirname, 'temp4.csv');
  fs.writeFileSync(testFile4, 'a,b,c\n5,10,15');

  const result4 = analyzeCSV(testFile4);
  deepEqual(result4.rowCount, 1, 'Single row: Should count 1 row');
  assert(result4.a === 5, 'Single row: Mean of single value should be that value');
  assert(result4.b === 10, 'Single row: All means should equal their single values');

  fs.unlinkSync(testFile4);

  // Create test file 5 with partially numeric column
  const testFile5 = path.join(__dirname, 'temp5.csv');
  fs.writeFileSync(testFile5, 'data,status\n10,ok\n20,error\n30,ok');

  const result5 = analyzeCSV(testFile5);
  deepEqual(result5.rowCount, 3, 'Partial numeric: Should count rows');
  assert(result5.data === 20, 'Partial numeric: Mean of fully numeric column');
  assert(result5.status === undefined, 'Partial numeric: Non-numeric column should not have mean');

  fs.unlinkSync(testFile5);
}

function testCLIIntegration() {
  console.log('\n=== Testing CLI Integration ===');

  // Test with actual sample.csv
  const samplePath = path.join(__dirname, '..', 'sample.csv');
  if (fs.existsSync(samplePath)) {
    const result = analyzeCSV(samplePath);
    assert(result.rowCount === 3, 'Sample file should have 3 rows');
    assert(result.incidents === 4, 'Sample file: incidents mean should be 4 ((3+5+4)/3)');
    assert(result.response_minutes === 15, 'Sample file: response_minutes mean should be 15 ((12+18+15)/3)');
  }
}

// Run all tests
testParseCSV();
testIsNumeric();
testAnalyzeCSV();
testCLIIntegration();

console.log(`\n=== Test Summary ===`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
}
