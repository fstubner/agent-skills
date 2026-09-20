import fs from 'node:fs';
import { toCsv } from './report.js';

const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
process.stdout.write(`${toCsv(input.items)}\n`);
