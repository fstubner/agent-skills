const { analyzeCSV } = require('./src/cli.js');

try {
  const result = analyzeCSV('sample.csv');
  console.log('Result:', JSON.stringify(result));
  console.log('');
  console.log('Verification:');
  console.log('✓ rowCount:', result.rowCount === 3 ? 'PASS' : 'FAIL');
  console.log('✓ incidents (mean of 3,5,4):', result.incidents === 4 ? 'PASS' : 'FAIL');
  console.log('✓ response_minutes (mean of 12,18,15):', result.response_minutes === 15 ? 'PASS' : 'FAIL');
  console.log('✓ team (non-numeric, should not appear):', result.team === undefined ? 'PASS' : 'FAIL');

  const allPass = result.rowCount === 3 &&
                  result.incidents === 4 &&
                  result.response_minutes === 15 &&
                  result.team === undefined;
  console.log('');
  console.log(allPass ? 'ALL CHECKS PASSED ✓' : 'SOME CHECKS FAILED ✗');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
