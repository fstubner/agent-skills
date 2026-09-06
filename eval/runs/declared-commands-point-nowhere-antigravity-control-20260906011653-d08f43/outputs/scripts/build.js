import fs from 'node:fs';

console.log('Building ledger-api...');
if (!fs.existsSync('./src/server.js') || !fs.existsSync('./src/index.js')) {
  console.error('Build failed: missing required source files.');
  process.exit(1);
}
console.log('Build completed successfully.');
