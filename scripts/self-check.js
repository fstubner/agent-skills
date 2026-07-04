#!/usr/bin/env node
// Run all frontend-design quality gates and emit self-check-report.json.
//
// Usage:
//   node self-check.js [--root .] [--skill-root path] [--out self-check-report.json]
//   node self-check.js --root ./my-app --base-url http://localhost:8769 --strict
//
// Delegates to ci-check.js when --base-url is set. Exit 1 on FAIL.

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const { findSkillRoot } = require('./lib-skill-root.cjs');

function parseArgs(argv) {
  const forwarded = [];
  let root = process.cwd();
  let outFile = 'self-check-report.json';
  let port = 8769;
  let smoke = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') root = path.resolve(argv[++i]);
    else if (a === '--out') outFile = argv[++i];
    else if (a === '--skill-root') forwarded.push('--skill-root', path.resolve(argv[++i]));
    else if (a === '--smoke') smoke = true;
    else if (a === '--port') port = Number(argv[++i]);
    else if (a === '--strict') forwarded.push('--strict');
    else if (a === '--base-url') forwarded.push('--base-url', argv[++i]);
    else if (a === '--config') forwarded.push('--config', path.resolve(argv[++i]));
    else if (a === '--tokens') forwarded.push('--tokens', argv[++i]);
    else if (a === '--skip-layout') forwarded.push('--skip-layout');
    else if (a === '--skip-smoke') forwarded.push('--skip-smoke');
  }

  forwarded.push('--root', root, '--out', outFile);
  if (smoke && !forwarded.includes('--base-url')) {
    forwarded.push('--base-url', `http://localhost:${port}`);
  }
  return forwarded;
}

function main() {
  const skillRoot = findSkillRoot();
  if (!skillRoot) {
    console.error('Cannot find skill root. Pass --skill-root or set FRONTEND_DESIGN_SKILL_ROOT.');
    process.exit(1);
  }

  const ciArgs = parseArgs(process.argv.slice(2));
  if (!ciArgs.includes('--base-url') && process.env.UI_CHECK_BASE_URL) {
    ciArgs.push('--base-url', process.env.UI_CHECK_BASE_URL);
  }

  const r = spawnSync(process.execPath, [path.join(skillRoot, 'scripts', 'ci-check.js'), ...ciArgs], {
    stdio: 'inherit',
    shell: false,
  });
  process.exit(r.status ?? 1);
}

main();
