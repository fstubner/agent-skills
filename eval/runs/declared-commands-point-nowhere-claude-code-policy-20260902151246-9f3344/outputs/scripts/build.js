import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Validate that all required entry points exist
const requiredFiles = [
  path.join(rootDir, 'src', 'index.js'),
  path.join(rootDir, 'src', 'server.js'),
  path.join(rootDir, 'package.json'),
];

const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));

if (missingFiles.length > 0) {
  console.error('Build failed: Missing required files:');
  missingFiles.forEach(file => console.error(`  - ${file}`));
  process.exit(1);
}

console.log('Build successful: all required files present');
