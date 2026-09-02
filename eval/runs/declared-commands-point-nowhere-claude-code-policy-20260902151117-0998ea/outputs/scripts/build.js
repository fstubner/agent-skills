#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dir, '..');

const requiredFiles = [
  'src/index.js',
  'src/server.js',
  'package.json',
];

console.log('Building ledger-api...');

for (const file of requiredFiles) {
  const filePath = path.join(projectRoot, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing required file: ${file}`);
    process.exit(1);
  }
}

console.log('✓ All required files present');
console.log('✓ Build successful');
