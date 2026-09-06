import fs from 'node:fs';

console.log('Building ledger-api...');
const entryPoints = ['src/index.js', 'src/server.js', 'bin/ledger.js'];
for (const entry of entryPoints) {
  if (!fs.existsSync(entry)) {
    throw new Error(`Build failed: Missing entry point ${entry}`);
  }
}
console.log('Build completed successfully.');
