#!/usr/bin/env node
// Registered backend checker. Reads its rule set from checker.config.json and
// walks the configured roots.
import fs from 'fs';
import path from 'path';

const root = process.argv.includes('--root') ? process.argv[process.argv.indexOf('--root') + 1] : '.';
const config = JSON.parse(fs.readFileSync(path.join(root, 'checker.config.json'), 'utf8'));

const findings = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(js|mjs|html)$/.test(entry.name)) {
      const text = fs.readFileSync(p, 'utf8');
      if (/(api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9_-]{12,}/i.test(text) && p.includes('public')) {
        findings.push({ rule: 'secretsInClientPaths', file: path.relative(root, p) });
      }
    }
  }
}
for (const r of config.roots) walk(path.join(root, r));

console.log(JSON.stringify({ schemaVersion: 2, checker: 'backend', findings }, null, 2));
process.exit(findings.length > 0 ? 1 : 0);
