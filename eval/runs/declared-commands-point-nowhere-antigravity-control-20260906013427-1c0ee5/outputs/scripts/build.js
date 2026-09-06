import { statSync } from 'node:fs';

const requiredFiles = ['src/index.js', 'src/server.js', 'bin/ledger.js'];

for (const file of requiredFiles) {
  try {
    statSync(file);
  } catch (err) {
    console.error(`Build error: missing required file ${file}`);
    process.exit(1);
  }
}

console.log('Build completed successfully.');
