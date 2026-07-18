#!/usr/bin/env node
// Fixture tests for deterministic verification scripts.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function runNode(script, args, cwd = root) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const failures = [];

function expect(name, cond, detail = '') {
  if (!cond) {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

// --- accept-check: SHIP reachable ---
{
  const fixture = path.join(root, 'fixtures/accept-ship');
  const r = runNode(path.join(root, 'product-acceptance/scripts/accept-check.js'), [
    '--root', fixture,
    '--acceptor-context', 'separate',
  ]);
  const report = readJSON(path.join(fixture, 'product-acceptance-report.json'));
  expect('accept-ship verdict SHIP', report.verdict === 'SHIP', report.verdict);
  expect('accept-ship exit 0', r.status === 0, String(r.status));
  const arch = report.checks.find((c) => c.id === 'D-arch');
  expect('accept-ship D-arch pass', arch?.status === 'pass', JSON.stringify(arch));
}

// --- accept-check: BLOCK no product ---
{
  const fixture = path.join(root, 'fixtures/accept-block-noproduct');
  const r = runNode(path.join(root, 'product-acceptance/scripts/accept-check.js'), [
    '--root', fixture,
    '--strict',
    '--acceptor-context', 'separate',
  ]);
  const report = readJSON(path.join(fixture, 'product-acceptance-report.json'));
  expect('accept-block verdict BLOCK', report.verdict === 'BLOCK', report.verdict);
  expect('accept-block exit 1', r.status === 1, String(r.status));
}

// --- accept-check: missing arch is not_evaluated, not pass ---
{
  const fixture = path.join(root, 'fixtures/accept-missing-arch');
  runNode(path.join(root, 'product-acceptance/scripts/accept-check.js'), [
    '--root', fixture,
    '--acceptor-context', 'separate',
  ]);
  const report = readJSON(path.join(fixture, 'product-acceptance-report.json'));
  const arch = report.checks.find((c) => c.id === 'D-arch');
  expect('accept-missing-arch D-arch not_evaluated', arch?.status === 'not_evaluated', JSON.stringify(arch));
  expect('accept-missing-arch not SHIP or CONDITIONAL with warning', report.verdict === 'CONDITIONAL', report.verdict);
}

// --- accept-check: same context BLOCKs ---
{
  const fixture = path.join(root, 'fixtures/accept-ship');
  runNode(path.join(root, 'product-acceptance/scripts/accept-check.js'), [
    '--root', fixture,
    '--acceptor-context', 'same',
  ]);
  const report = readJSON(path.join(fixture, 'product-acceptance-report.json'));
  expect('accept-same-context BLOCK', report.verdict === 'BLOCK', report.verdict);
}

// --- architecture ---
{
  const fixture = path.join(root, 'fixtures/arch-block-nodoc');
  const r = runNode(path.join(root, 'systems-architecture/scripts/check-architecture.js'), [
    '--root', fixture,
    '--strict',
  ]);
  const report = readJSON(path.join(fixture, 'architecture-report.json'));
  expect('arch-block-nodoc BLOCK', report.verdict === 'BLOCK', report.verdict);
  expect('arch-block-nodoc exit 1', r.status === 1, String(r.status));
}
{
  const fixture = path.join(root, 'fixtures/arch-ship');
  const r = runNode(path.join(root, 'systems-architecture/scripts/check-architecture.js'), [
    '--root', fixture,
    '--strict',
  ]);
  const report = readJSON(path.join(fixture, 'architecture-report.json'));
  expect('arch-ship not BLOCK', report.verdict !== 'BLOCK', report.verdict);
  expect('arch-ship exit 0', r.status === 0, String(r.status));
}

// --- structure dual icons ---
{
  const fixture = path.join(root, 'fixtures/eng-block-dual-icons');
  const r = runNode(path.join(root, 'frontend-engineering/scripts/check-structure.js'), [
    '--root', fixture,
    '--strict',
  ]);
  const report = readJSON(path.join(fixture, 'eng-structure-report.json'));
  expect('eng-dual-icons BLOCK', report.verdict === 'BLOCK', report.verdict);
  expect('eng-dual-icons exit 1', r.status === 1, String(r.status));
}

// --- SKILL.md front matter + manifest ---
{
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'suite.manifest.json'), 'utf8'));
  for (const name of manifest.skills) {
    const skillPath = path.join(root, name, 'SKILL.md');
    expect(`skill exists ${name}`, fs.existsSync(skillPath));
    const text = fs.readFileSync(skillPath, 'utf8');
    expect(`frontmatter ${name}`, text.startsWith('---\n') && /name:\s*\S+/.test(text) && /description:\s*>?-?/.test(text));
  }
  const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
  expect('VERSION non-empty', Boolean(version));
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log('\nAll fixture tests passed.');
