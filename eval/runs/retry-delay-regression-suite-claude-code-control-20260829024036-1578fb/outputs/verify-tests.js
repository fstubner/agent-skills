import { execSync } from 'child_process';

console.log('Running test suite...\n');
try {
  execSync('node --test', { stdio: 'inherit', cwd: process.cwd() });
  console.log('\n✓ All tests passed');
  process.exit(0);
} catch (error) {
  console.error('\n✗ Tests failed');
  process.exit(1);
}
