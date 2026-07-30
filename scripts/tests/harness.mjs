// Shared test harness. Everything stateful the test modules need lives here
// so each module can be imported independently and in any order.
//
// Split out of a single 1320-line run-tests.mjs because the suite's own
// code-smells checker (S-large-file, 400 lines) flagged it — and since the
// runner is touched by nearly every commit, the pre-commit hook's staged-file
// scoping couldn't grandfather it away. Dogfooding: the checker was right,
// and one file holding twenty-six unrelated concerns was genuinely hard to
// navigate.
//
// Design rules inherited from the original runner:
// - CRLF-proof: every text read is normalized; nothing here can break on a
//   Windows checkout (v0.4's runner failed 8/8 frontmatter checks on the
//   maintainer's own OS).
// - Fixtures are copied to a temp dir before checkers run — committed
//   fixtures are never mutated.
// - Block fixtures assert the SPECIFIC failing check id, not just the
//   verdict, so a checker that blocks for the wrong reason fails the test.

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function read(p) {
  return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}

export const registry = JSON.parse(read(path.join(root, 'registry.json')));

// Private counter rather than an exported binding: ES module exports are
// live bindings but not writable from importers, so a shared mutable count
// has to go through functions.
let failures = 0;
export function expect(name, cond, detail = '') {
  if (cond) console.log(`ok    ${name}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
export function failureCount() {
  return failures;
}

export function runNode(script, args, opts = {}) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, ...opts });
}

export function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.agent-evidence'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

export function pathToFileUrl(p) {
  return 'file:///' + p.split(path.sep).join('/');
}

export const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-tests-'));

export function runFixture(fixture, script, extraArgs = []) {
  const src = path.join(root, 'fixtures', fixture);
  const dest = path.join(tmpBase, fixture + '-' + Math.random().toString(36).slice(2, 8));
  fs.cpSync(src, dest, { recursive: true });
  const r = runNode(path.join(root, ...script.split('/')), ['--root', dest, ...extraArgs]);
  let report = null;
  try { report = JSON.parse(r.stdout); } catch { /* asserted below */ }
  return { r, report };
}

export function assertFixture(name, fixture, script, extraArgs, wantVerdict, wantChecks = []) {
  const { r, report } = runFixture(fixture, script, extraArgs);
  expect(`${name}: emits parseable report`, report !== null, (r.stderr || '').slice(0, 200));
  if (!report) return null;
  expect(`${name}: verdict ${wantVerdict}`, report.verdict === wantVerdict,
    `got ${report.verdict}: ${JSON.stringify(report.checks)}`);
  for (const [id, status] of wantChecks) {
    const c = report.checks.find((x) => x.id === id);
    expect(`${name}: check ${id} is ${status}`, Boolean(c) && c.status === status,
      c ? `${c.status} (${c.detail})` : 'check missing');
  }
  const wantExit = wantVerdict === 'BLOCK' ? 1 : 0;
  expect(`${name}: exit code ${wantExit}`, r.status === wantExit, `got ${r.status}`);
  return report;
}

export function cleanup() {
  fs.rmSync(tmpBase, { recursive: true, force: true });
}

export const ARCH = 'systems-architecture/scripts/check-architecture.js';
export const BACKEND = 'backend-engineering/scripts/check-backend.js';
export const FRONTEND = 'frontend/scripts/check-frontend.js';
export const ACCEPT = 'product-acceptance/scripts/accept-check.js';
