#!/usr/bin/env node
/**
 * Fail CI when changed lines introduce hardcoded hex colors or raw px in spacing props.
 *
 * Usage:
 *   node audit-diff.js [--base main] [--root .]
 *
 * Exit 1 if added lines in CSS/SCSS contain banned patterns.
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_PX = /\b(padding|margin|gap|font-size|border-radius|top|left|right|bottom|width|height)\s*:\s*[^;{}]*\d+px/i;

function parseArgs(argv) {
  const out = { base: 'main', root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') out.base = argv[++i];
    else if (argv[i] === '--root') out.root = path.resolve(argv[++i]);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const diff = spawnSync('git', ['diff', `${args.base}...HEAD`, '--unified=0', '--', '*.css', '*.scss'], {
    cwd: args.root,
    encoding: 'utf8',
  });

  if (diff.status !== 0 && !diff.stdout) {
    console.log('audit-diff: no git diff or not a repo — skipping');
    process.exit(0);
  }

  const findings = [];
  const lines = (diff.stdout || '').split(/\r?\n/);
  let currentFile = '';

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
      continue;
    }
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    const added = line.slice(1);
    if (HEX.test(added)) {
      findings.push({ file: currentFile, line: added.trim(), rule: 'hardcoded-hex' });
    }
    if (RAW_PX.test(added) && !added.includes('var(--')) {
      findings.push({ file: currentFile, line: added.trim(), rule: 'raw-px' });
    }
  }

  if (!findings.length) {
    console.log('audit-diff: no banned patterns in CSS diff');
    process.exit(0);
  }

  console.log(`\naudit-diff: ${findings.length} finding(s) in diff vs ${args.base}`);
  for (const f of findings.slice(0, 20)) {
    console.log(`  ${f.rule} ${f.file}: ${f.line}`);
  }
  if (findings.length > 20) console.log(`  … and ${findings.length - 20} more`);
  console.log('');
  process.exit(1);
}

main();
