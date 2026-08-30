#!/usr/bin/env node
// Applies every .sql file in migrations/ in filename order.
import fs from 'fs';
import path from 'path';
import { query } from '../src/db.js';

const dir = path.join(import.meta.dirname, '..', 'migrations');
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  await query(fs.readFileSync(path.join(dir, file), 'utf8'));
  console.log('applied', file);
}
