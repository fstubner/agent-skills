const { parseCSV, isNumeric, analyzeCSV } = require('../src/cli.js');
const fs = require('fs');
const path = require('path');

console.log('=== Testing Edge Cases ===\n');

// Test 1: Negative numbers and decimals
console.log('Test 1: Negative numbers and decimals');
const testFile1 = path.join(__dirname, 'edge1.csv');
fs.writeFileSync(testFile1, 'name,profit,change\nQ1,-1000.50,-5.5\nQ2,2500.75,8.3\nQ3,500.25,2.1');
const result1 = analyzeCSV(testFile1);
console.log(`Result:`, JSON.stringify(result1));
console.log(`Expected: rowCount=3, profit≈653.5, change≈1.63`);
const profitMean = ((-1000.50) + 2500.75 + 500.25) / 3;
const changeMean = ((-5.5) + 8.3 + 2.1) / 3;
console.log(`Calculated: profit=${profitMean}, change=${changeMean}`);
console.log(`Match: ${Math.abs(result1.profit - profitMean) < 0.01 && Math.abs(result1.change - changeMean) < 0.01 ? '✓' : '✗'}\n`);
fs.unlinkSync(testFile1);

// Test 2: Partially empty numeric columns
console.log('Test 2: Partially empty numeric columns');
const testFile2 = path.join(__dirname, 'edge2.csv');
fs.writeFileSync(testFile2, 'id,value\n1,100\n2,\n3,200');
const result2 = analyzeCSV(testFile2);
console.log(`Result:`, JSON.stringify(result2));
console.log(`Expected: rowCount=3, id=2, value=150 (only counting non-empty)`);
console.log(`Match: ${result2.rowCount === 3 && result2.id === 2 && result2.value === 150 ? '✓' : '✗'}\n`);
fs.unlinkSync(testFile2);

// Test 3: Scientific notation
console.log('Test 3: Scientific notation');
const testFile3 = path.join(__dirname, 'edge3.csv');
fs.writeFileSync(testFile3, 'measure\n1e3\n2e3\n3e3');
const result3 = analyzeCSV(testFile3);
console.log(`Result:`, JSON.stringify(result3));
console.log(`Expected: rowCount=3, measure=2000 (mean of 1000, 2000, 3000)`);
console.log(`Match: ${result3.rowCount === 3 && result3.measure === 2000 ? '✓' : '✗'}\n`);
fs.unlinkSync(testFile3);

// Test 4: Many columns with mixed types
console.log('Test 4: Many columns with mixed types');
const testFile4 = path.join(__dirname, 'edge4.csv');
fs.writeFileSync(testFile4, 'a,b,c,d,e\n1,x,5,yes,10\n2,y,10,no,20\n3,z,15,maybe,30');
const result4 = analyzeCSV(testFile4);
console.log(`Result:`, JSON.stringify(result4));
console.log(`Expected: rowCount=3, a=2, c=10, e=20; no b, d`);
console.log(`Match: ${result4.rowCount === 3 && result4.a === 2 && result4.c === 10 && result4.e === 20 && result4.b === undefined && result4.d === undefined ? '✓' : '✗'}\n`);
fs.unlinkSync(testFile4);

// Test 5: Whitespace in numeric values
console.log('Test 5: Whitespace in numeric values');
const testFile5 = path.join(__dirname, 'edge5.csv');
fs.writeFileSync(testFile5, 'value\n  10  \n  20  \n  30  ');
const result5 = analyzeCSV(testFile5);
console.log(`Result:`, JSON.stringify(result5));
console.log(`Expected: rowCount=3, value=20`);
console.log(`Match: ${result5.rowCount === 3 && result5.value === 20 ? '✓' : '✗'}\n`);
fs.unlinkSync(testFile5);

// Test 6: All rows with non-numeric data
console.log('Test 6: All rows with non-numeric data in numeric-looking column');
const testFile6 = path.join(__dirname, 'edge6.csv');
fs.writeFileSync(testFile6, 'id,status\n1,pending\n2,complete\n3,error');
const result6 = analyzeCSV(testFile6);
console.log(`Result:`, JSON.stringify(result6));
console.log(`Expected: rowCount=3, id=2, no status`);
console.log(`Match: ${result6.rowCount === 3 && result6.id === 2 && result6.status === undefined ? '✓' : '✗'}\n`);
fs.unlinkSync(testFile6);

console.log('=== Edge Case Testing Complete ===');
