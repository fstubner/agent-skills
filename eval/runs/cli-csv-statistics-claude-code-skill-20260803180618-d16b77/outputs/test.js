#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testDir = path.join(__dirname, 'test-data');
const cliPath = path.join(__dirname, 'src', 'cli.js');

function ensureTestDir() {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
}

function writeTestFile(filename, content) {
  fs.writeFileSync(path.join(testDir, filename), content);
}

function runCli(csvPath) {
  try {
    const result = execSync(`node "${cliPath}" "${csvPath}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output: result.trim(), error: null };
  } catch (err) {
    return {
      success: false,
      output: err.stdout ? err.stdout.trim() : '',
      error: err.stderr ? err.stderr.trim() : err.message,
      exitCode: err.status
    };
  }
}

function assertEqual(actual, expected, testName) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`✓ ${testName}`);
    return true;
  } else {
    console.log(`✗ ${testName}`);
    console.log(`  Expected: ${JSON.stringify(expected)}`);
    console.log(`  Actual:   ${JSON.stringify(actual)}`);
    return false;
  }
}

function test() {
  let passed = 0;
  let failed = 0;

  ensureTestDir();

  // Test 1: Basic numeric columns
  writeTestFile('basic.csv', `team,incidents,response_minutes
alpha,3,12
beta,5,18
gamma,4,15`);

  const result1 = runCli(path.join(testDir, 'basic.csv'));
  if (result1.success) {
    const output1 = JSON.parse(result1.output);
    if (assertEqual(output1, {
      rowCount: 3,
      incidents: 4,
      response_minutes: 15
    }, 'Test 1: Basic numeric columns')) {
      passed++;
    } else {
      failed++;
    }
  } else {
    console.log(`✗ Test 1: Basic numeric columns - ${result1.error}`);
    failed++;
  }

  // Test 2: Mixed string and numeric columns
  writeTestFile('mixed.csv', `name,age,score
alice,25,85.5
bob,30,92
charlie,22,78.5`);

  const result2 = runCli(path.join(testDir, 'mixed.csv'));
  if (result2.success) {
    const output2 = JSON.parse(result2.output);
    if (assertEqual(output2, {
      rowCount: 3,
      age: 25.666666666666668,
      score: 85.33333333333333
    }, 'Test 2: Mixed string and numeric columns')) {
      passed++;
    } else {
      failed++;
    }
  } else {
    console.log(`✗ Test 2: Mixed string and numeric columns - ${result2.error}`);
    failed++;
  }

  // Test 3: Single row
  writeTestFile('single.csv', `id,value
1,100`);

  const result3 = runCli(path.join(testDir, 'single.csv'));
  if (result3.success) {
    const output3 = JSON.parse(result3.output);
    if (assertEqual(output3, {
      rowCount: 1,
      id: 1,
      value: 100
    }, 'Test 3: Single row')) {
      passed++;
    } else {
      failed++;
    }
  } else {
    console.log(`✗ Test 3: Single row - ${result3.error}`);
    failed++;
  }

  // Test 4: Empty string values (should not be counted as numeric)
  writeTestFile('empty.csv', `a,b,c
1,,3
4,5,
7,8,9`);

  const result4 = runCli(path.join(testDir, 'empty.csv'));
  if (result4.success) {
    const output4 = JSON.parse(result4.output);
    if (assertEqual(output4, {
      rowCount: 3,
      a: 4,
      b: 6.5,
      c: 6
    }, 'Test 4: Empty string values')) {
      passed++;
    } else {
      failed++;
    }
  } else {
    console.log(`✗ Test 4: Empty string values - ${result4.error}`);
    failed++;
  }

  // Test 5: Non-numeric column (should not have mean in output)
  writeTestFile('nonumeric.csv', `id,name,value
1,apple,10
2,banana,20
3,cherry,30`);

  const result5 = runCli(path.join(testDir, 'nonumeric.csv'));
  if (result5.success) {
    const output5 = JSON.parse(result5.output);
    if (assertEqual(output5, {
      rowCount: 3,
      id: 2,
      value: 20
    }, 'Test 5: Non-numeric column excluded')) {
      passed++;
    } else {
      failed++;
    }
  } else {
    console.log(`✗ Test 5: Non-numeric column excluded - ${result5.error}`);
    failed++;
  }

  // Test 6: Negative numbers
  writeTestFile('negative.csv', `value,delta
100,-10
50,-20
200,5`);

  const result6 = runCli(path.join(testDir, 'negative.csv'));
  if (result6.success) {
    const output6 = JSON.parse(result6.output);
    if (assertEqual(output6, {
      rowCount: 3,
      value: 116.66666666666667,
      delta: -8.333333333333334
    }, 'Test 6: Negative numbers')) {
      passed++;
    } else {
      failed++;
    }
  } else {
    console.log(`✗ Test 6: Negative numbers - ${result6.error}`);
    failed++;
  }

  // Test 7: File not found
  const result7 = runCli(path.join(testDir, 'nonexistent.csv'));
  if (!result7.success && result7.exitCode === 1) {
    console.log(`✓ Test 7: File not found error`);
    passed++;
  } else {
    console.log(`✗ Test 7: File not found error - should exit with code 1`);
    failed++;
  }

  // Test 8: Help flag
  try {
    const helpResult = execSync(`node "${cliPath}" --help`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(`✗ Test 8: Help flag should exit cleanly`);
    failed++;
  } catch (err) {
    if (err.status === 0 && err.stderr && err.stderr.includes('Usage')) {
      console.log(`✓ Test 8: Help flag`);
      passed++;
    } else {
      console.log(`✗ Test 8: Help flag - unexpected result`);
      failed++;
    }
  }

  // Test 9: Version flag
  try {
    const versionResult = execSync(`node "${cliPath}" --version`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    if (versionResult.includes('1.0.0')) {
      console.log(`✓ Test 9: Version flag`);
      passed++;
    } else {
      console.log(`✗ Test 9: Version flag - unexpected version`);
      failed++;
    }
  } catch (err) {
    console.log(`✗ Test 9: Version flag - ${err.message}`);
    failed++;
  }

  // Test 10: No arguments
  try {
    execSync(`node "${cliPath}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(`✗ Test 10: No arguments should fail`);
    failed++;
  } catch (err) {
    if (err.status === 1 && err.stderr && err.stderr.includes('Usage')) {
      console.log(`✓ Test 10: No arguments shows usage`);
      passed++;
    } else {
      console.log(`✗ Test 10: No arguments - unexpected result`);
      failed++;
    }
  }

  // Test 11: Decimal numbers
  writeTestFile('decimals.csv', `x,y
1.5,2.5
2.5,3.5
3.5,4.5`);

  const result11 = runCli(path.join(testDir, 'decimals.csv'));
  if (result11.success) {
    const output11 = JSON.parse(result11.output);
    if (assertEqual(output11, {
      rowCount: 3,
      x: 2.5,
      y: 3.5
    }, 'Test 11: Decimal numbers')) {
      passed++;
    } else {
      failed++;
    }
  } else {
    console.log(`✗ Test 11: Decimal numbers - ${result11.error}`);
    failed++;
  }

  // Test 12: Only headers, no data
  writeTestFile('headers-only.csv', `col1,col2,col3`);

  const result12 = runCli(path.join(testDir, 'headers-only.csv'));
  if (!result12.success && result12.exitCode === 1) {
    console.log(`✓ Test 12: Headers-only file error`);
    passed++;
  } else {
    console.log(`✗ Test 12: Headers-only file should error`);
    failed++;
  }

  // Cleanup
  try {
    fs.rmSync(testDir, { recursive: true });
  } catch (e) {
    // ignore cleanup errors
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

test();
