import fs from 'node:fs';

console.log('Building ledger-api...');

const requiredFiles = ['src/server.js', 'src/index.js'];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`Build failed: Missing required file ${file}`);
    process.exit(1);
  }
}

console.log('Build completed successfully.');
