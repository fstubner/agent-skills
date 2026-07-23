#!/usr/bin/env node
// Suite test runner. Design rules:
// - CRLF-proof: every text read is normalized; nothing here can break on a
//   Windows checkout (v0.4's runner failed 8/8 frontmatter checks on the
//   maintainer's own OS).
// - Fixtures are copied to a temp dir before checkers run — committed
//   fixtures are never mutated.
// - Block fixtures assert the SPECIFIC failing check id, not just the
//   verdict, so a checker that blocks for the wrong reason fails the test.
// - The registry is cross-checked against the filesystem: a skill or
//   producer script that exists in one but not the other fails CI.

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(read(path.join(root, 'registry.json')));

let failures = 0;
function read(p) {
  return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}
function expect(name, cond, detail = '') {
  if (cond) console.log(`ok    ${name}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function runNode(script, args, opts = {}) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, ...opts });
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.agent-evidence'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ---------- 1. Syntax-check every script in the suite ----------
{
  const scripts = walk(root).filter((f) => /\.(js|cjs|mjs)$/.test(f));
  for (const s of scripts) {
    const r = spawnSync(process.execPath, ['--check', s], { encoding: 'utf8' });
    expect(`syntax ${path.relative(root, s)}`, r.status === 0, (r.stderr || '').split('\n')[0]);
  }
}

// ---------- 2. Registry <-> filesystem cross-check ----------
{
  const ids = registry.skills.map((s) => s.id);
  expect('registry: entrySkill is a registered skill', ids.includes(registry.entrySkill));
  for (const skill of registry.skills) {
    const skillMd = path.join(root, skill.id, 'SKILL.md');
    expect(`registry: skill dir + SKILL.md exists (${skill.id})`, fs.existsSync(skillMd));
    if (!fs.existsSync(skillMd)) continue;
    const text = read(skillMd);
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
    expect(`frontmatter parses (${skill.id})`, Boolean(fmMatch));
    if (!fmMatch) continue;
    const nameMatch = fmMatch[1].match(/^name:\s*(\S+)\s*$/m);
    expect(`frontmatter name matches dir (${skill.id})`, Boolean(nameMatch) && nameMatch[1] === skill.id,
      nameMatch ? nameMatch[1] : 'no name:');
    const descBlock = fmMatch[1].replace(/^name:.*$/m, '');
    expect(`frontmatter description is substantial (${skill.id})`,
      /description:/.test(fmMatch[1]) && descBlock.replace(/\s+/g, ' ').length > 80);
  }
  for (const a of registry.artifacts) {
    expect(`registry: producer is a registered skill (${a.id})`, ids.includes(a.producer));
    for (const c of a.consumers) {
      expect(`registry: consumer is a registered skill (${a.id} -> ${c})`, ids.includes(c));
    }
    if (a.producerScript) {
      expect(`registry: producer script exists (${a.producerScript})`,
        fs.existsSync(path.join(root, ...a.producerScript.split('/'))));
    }
    if (a.schema) {
      expect(`registry: schema exists (${a.schema})`,
        fs.existsSync(path.join(root, ...a.schema.split('/'))));
    }
  }
}

// ---------- 3. Schema validator unit tests (drift must fail loudly) ----------
{
  const { validate } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'schema.cjs')));
  const s = { type: 'object', required: ['model'], properties: { model: { type: 'string', minLength: 1 }, runIndex: { type: 'integer', minimum: 1 } } };
  expect('schema: minLength enforced', validate(s, { model: '' }).length === 1);
  expect('schema: minimum enforced', validate(s, { model: 'x', runIndex: 0 }).length === 1);
  expect('schema: valid object passes', validate(s, { model: 'x', runIndex: 1 }).length === 0);
  expect('schema: missing required caught', validate(s, {}).length === 1);
  let threw = false;
  try { validate({ type: 'string', format: 'email' }, 'x'); } catch { threw = true; }
  expect('schema: unknown keyword THROWS instead of silently passing', threw);
  const ap = { type: 'object', additionalProperties: { enum: ['pass', 'fail'] } };
  expect('schema: object-form additionalProperties validates values', validate(ap, { a: 'nope' }).length === 1);
}
function pathToFileUrl(p) {
  return 'file:///' + p.split(path.sep).join('/');
}

// ---------- 4. Fixture runs (temp copies; pinned check ids) ----------
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-tests-'));
function runFixture(fixture, script, extraArgs = []) {
  const src = path.join(root, 'fixtures', fixture);
  const dest = path.join(tmpBase, fixture + '-' + Math.random().toString(36).slice(2, 8));
  fs.cpSync(src, dest, { recursive: true });
  const r = runNode(path.join(root, ...script.split('/')), ['--root', dest, ...extraArgs]);
  let report = null;
  try { report = JSON.parse(r.stdout); } catch { /* asserted below */ }
  return { r, report };
}
function assertFixture(name, fixture, script, extraArgs, wantVerdict, wantChecks = []) {
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

const ARCH = 'systems-architecture/scripts/check-architecture.js';
const BACKEND = 'backend-engineering/scripts/check-backend.js';
const FRONTEND = 'frontend/scripts/check-frontend.js';
const ACCEPT = 'product-acceptance/scripts/accept-check.js';

assertFixture('arch-ship', 'arch-ship', ARCH, [], 'SHIP',
  [['P-arch-doc', 'pass'], ['P-section-trust', 'pass']]);
assertFixture('arch-block-nodoc', 'arch-block-nodoc', ARCH, [], 'BLOCK',
  [['P-arch-doc', 'fail'], ['P-section-parts', 'not_evaluated']]);

// backend-ship contains the literal string "task-management" in a client
// file — regression test for the v0.4 secret scanner that BLOCKed on it.
assertFixture('backend-ship (task-management is not a secret)', 'backend-ship', BACKEND, [], 'SHIP',
  [['B-client-secrets', 'pass'], ['B-dual-orm', 'pass']]);
assertFixture('backend-block-dual-orm', 'backend-block-dual-orm', BACKEND, [], 'BLOCK',
  [['B-dual-orm', 'fail']]);
const secretReport = assertFixture('backend-block-secret', 'backend-block-secret', BACKEND, [], 'BLOCK',
  [['B-client-secrets', 'fail']]);
if (secretReport) {
  const detail = secretReport.checks.find((c) => c.id === 'B-client-secrets').detail;
  expect('backend-block-secret: reports path, never the value',
    detail.includes('public/app.js') && !detail.includes('sk_live_'), detail);
}

assertFixture('frontend-ship', 'frontend-ship', FRONTEND, [], 'SHIP',
  [['F-dual-framework', 'pass'], ['F-tokens-contrast', 'pass']]);
assertFixture('frontend-block-dual-framework', 'frontend-block-dual-framework', FRONTEND, [], 'BLOCK',
  [['F-dual-framework', 'fail']]);

// Acceptance: re-runs producers fresh. The backend-block case is THE
// regression test for v0.4's open backend loop — a backend BLOCK must
// block the ship.
assertFixture('accept-ship (separate context)', 'accept-ship', ACCEPT,
  ['--acceptor-context', 'separate'], 'SHIP',
  [['A-independent', 'pass'], ['A-product-contract', 'pass'],
   ['D-systems-architecture', 'pass'], ['D-frontend', 'pass'], ['D-backend-engineering', 'pass']]);
assertFixture('accept-ship (same context caps at CONDITIONAL)', 'accept-ship', ACCEPT,
  [], 'CONDITIONAL', [['A-independent', 'not_evaluated']]);
assertFixture('accept-block-backend (backend BLOCK blocks the ship)', 'accept-block-backend', ACCEPT,
  ['--acceptor-context', 'separate'], 'BLOCK', [['D-backend-engineering', 'fail']]);
assertFixture('accept-block-noproduct', 'accept-block-noproduct', ACCEPT,
  ['--acceptor-context', 'separate'], 'BLOCK', [['A-product-contract', 'fail']]);

// Every emitted report must validate against the unified schema.
{
  const { validate } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'schema.cjs')));
  const schema = JSON.parse(read(path.join(root, 'core', 'schemas', 'check-report.schema.json')));
  const { report } = runFixture('accept-ship', ACCEPT, ['--acceptor-context', 'separate']);
  const errors = report ? validate(schema, report) : ['no report'];
  expect('acceptance report validates against check-report schema', errors.length === 0, errors.join('; '));
}

// ---------- 5. anti-ai-slop (skips only when vale is absent; CI installs vale) ----------
{
  const probe = spawnSync('vale', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.log('skip  anti-ai-slop fixtures: vale not installed (CI installs it; install locally to run these)');
  } else {
    const script = path.join(root, 'anti-ai-slop', 'scripts', 'check-prose.js');
    const clean = runNode(script, [path.join(root, 'fixtures', 'anti-ai-slop-clean', 'doc.md')]);
    const cleanReport = JSON.parse(clean.stdout);
    expect('anti-ai-slop: clean doc verdict SHIP', cleanReport.verdict === 'SHIP', cleanReport.verdict);
    const slop = runNode(script, [path.join(root, 'fixtures', 'anti-ai-slop-slop', 'doc.md')]);
    const slopReport = JSON.parse(slop.stdout);
    expect('anti-ai-slop: slop doc verdict CONDITIONAL', slopReport.verdict === 'CONDITIONAL', slopReport.verdict);
    const ids = new Set(slopReport.checks.map((c) => c.id));
    for (const rule of ['AntiAISlop.InflatedVocabulary', 'AntiAISlop.ThroatClearing', 'AntiAISlop.WeaselAttribution',
      'AntiAISlop.ImportanceInflation', 'AntiAISlop.SummaryRecap', 'AntiAISlop.EmDashOveruse']) {
      expect(`anti-ai-slop: rule fires ${rule}`, ids.has(rule), [...ids].join(', '));
    }
  }
}

// ---------- 6. Contract doc drift + version consistency ----------
{
  const r = runNode(path.join(root, 'scripts', 'gen-contract.mjs'), ['--check']);
  expect('docs/CONTRACT.md matches registry.json', r.status === 0, (r.stderr || '').trim());
  const version = read(path.join(root, registry.suiteVersionFile)).trim();
  const changelog = read(path.join(root, 'CHANGELOG.md'));
  expect(`CHANGELOG has an entry for VERSION (${version})`, changelog.includes(`## ${version}`));
}

// ---------- 7. Eval assets ----------
{
  const caseFiles = fs.readdirSync(path.join(root, 'eval', 'cases')).filter((f) => f.endsWith('.json'));
  expect('eval: at least one case exists', caseFiles.length >= 1);
  for (const f of caseFiles) {
    const c = JSON.parse(read(path.join(root, 'eval', 'cases', f)));
    expect(`eval case ${f}: id matches filename`, c.id === f.replace(/\.json$/, ''));
    expect(`eval case ${f}: has prompt and scoring`, typeof c.prompt === 'string' && c.scoring && Object.keys(c.scoring).length > 0);
  }
}

fs.rmSync(tmpBase, { recursive: true, force: true });
console.log(failures === 0 ? '\nAll tests passed.' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
