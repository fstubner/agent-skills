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
  expect('registry: defaultSkill is a registered skill', ids.includes(registry.defaultSkill));
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
  // REVERSE check: every top-level directory that has a SKILL.md must be
  // registered. Without this, a new skill dropped on disk but never added
  // to registry.json passes every other test silently — never installed,
  // never gated, never documented (this was the exact shape of the v0.4
  // "backend-report produced but never consumed" bug: a producer that
  // exists on disk but has no registry entry to wire it in).
  const SKIP_TOP_LEVEL = new Set(['core', 'docs', 'eval', 'fixtures', 'scripts', 'node_modules', '.git', '.github']);
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP_TOP_LEVEL.has(entry.name) || entry.name.startsWith('.')) continue;
    if (!fs.existsSync(path.join(root, entry.name, 'SKILL.md'))) continue;
    expect(`registry: on-disk skill "${entry.name}" is registered in registry.json`, ids.includes(entry.name));
  }
  const KNOWN_REQUIRED_WHEN = ['always', 'never', 'multi_part', 'server_present', 'frontend_present'];
  for (const a of registry.artifacts) {
    expect(`registry: producer is a registered skill (${a.id})`, ids.includes(a.producer));
    for (const c of a.consumers) {
      expect(`registry: consumer is a registered skill (${a.id} -> ${c})`, ids.includes(c));
    }
    expect(`registry: requiredWhen is a known condition (${a.id}: ${a.requiredWhen})`,
      KNOWN_REQUIRED_WHEN.includes(a.requiredWhen));
    expect(`registry: acceptanceGated is a boolean (${a.id})`, typeof a.acceptanceGated === 'boolean');
    if (a.producerScript) {
      expect(`registry: producer script exists (${a.producerScript})`,
        fs.existsSync(path.join(root, ...a.producerScript.split('/'))));
    }
    if (a.schema) {
      expect(`registry: schema exists (${a.schema})`,
        fs.existsSync(path.join(root, ...a.schema.split('/'))));
    }
    // Report-kind artifacts with a producerScript must be structurally
    // derivable: the checker looks itself up via
    // `registry.artifacts.find(x => x.producer === skill && x.kind === 'report')`,
    // so exactly one such entry must exist per report-producing skill —
    // ambiguity here would make a checker pick the wrong reportFile silently.
    if (a.kind === 'report' && a.producerScript && a.file) {
      const matches = registry.artifacts.filter((x) => x.producer === a.producer && x.kind === 'report');
      expect(`registry: exactly one report artifact for producer "${a.producer}"`, matches.length === 1,
        `found ${matches.length}`);
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

  // Regression: the unknown-keyword guard must be STATIC (walk the whole
  // schema up front), not data-path-dependent — a keyword under a branch
  // the data never touches must still throw, or drift in an untested
  // branch ships silently.
  let threwUnreached = false;
  try {
    validate({ type: 'object', properties: { a: { type: 'string' }, b: { type: 'string', format: 'email' } }, required: ['a'] }, { a: 'hello' });
  } catch { threwUnreached = true; }
  expect('schema: unknown keyword throws even on a branch the data never reaches', threwUnreached);

  // Regression: `type` as an array of allowed types must validate correctly,
  // not be silently mishandled while still being in the implemented-keyword set.
  const typeArraySchema = { type: ['string', 'null'] };
  expect('schema: type array accepts a matching string', validate(typeArraySchema, 'hello').length === 0);
  expect('schema: type array accepts a matching null', validate(typeArraySchema, null).length === 0);
  expect('schema: type array rejects a non-matching type', validate(typeArraySchema, 42).length === 1);
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
// Regression for mutant M7 (hasHeading returns true always): a doc that IS
// present but is missing one required heading must still BLOCK on that
// specific section, with the other present sections still passing — this
// cannot be satisfied by a vacuous "heading always found" implementation.
assertFixture('arch-block-missing-heading (doc present, one heading missing)', 'arch-block-missing-heading', ARCH, [], 'BLOCK',
  [['P-arch-doc', 'pass'], ['P-section-parts', 'pass'], ['P-section-boundaries', 'pass'], ['P-section-trust', 'fail']]);
// The "not applicable" skip path had never been exercised by any fixture —
// every prior arch fixture was multi-part by construction.
assertFixture('arch-ship-single-part (P-scope skip path)', 'arch-ship-single-part', ARCH, [], 'SHIP',
  [['P-scope', 'pass']]);
// Proves CRLF target-project files (e.g. an ARCHITECTURE.md edited on
// Windows — the suite's own .gitattributes has no power over a target
// project's line endings) parse correctly end to end. Committed as literal
// CRLF, pinned `-text` in .gitattributes so no checkout platform converts
// it. NOTE: this does NOT discriminate readText's CRLF-normalize call
// specifically — verified empirically that hasHeading's regex
// (^#{1,6}\s+name\b, multiline) already tolerates \r on its own, so
// removing the normalize step is a confirmed EQUIVALENT mutant given
// today's checks, not a live coverage gap. Kept as a real-world regression
// test and as insurance for a future check that isn't CRLF-tolerant by luck.
assertFixture('arch-ship-crlf (target ARCHITECTURE.md has real CRLF line endings)', 'arch-ship-crlf', ARCH, [], 'SHIP',
  [['P-arch-doc', 'pass'], ['P-section-parts', 'pass'], ['P-section-boundaries', 'pass'], ['P-section-trust', 'pass']]);

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
// The "no server" skip path had never been exercised by any fixture.
assertFixture('backend-no-server (B-scope skip path)', 'backend-no-server', BACKEND, [], 'SHIP',
  [['B-scope', 'pass']]);
// v0.4 had this fixture (backend-block-noarch); it was dropped in the v2
// rebuild, leaving B-arch-doc's fail branch with zero coverage.
assertFixture('backend-block-noarch (multi-part backend, no ARCHITECTURE.md)', 'backend-block-noarch', BACKEND, [], 'BLOCK',
  [['B-arch-doc', 'fail']]);

assertFixture('frontend-ship', 'frontend-ship', FRONTEND, [], 'SHIP',
  [['F-dual-framework', 'pass'], ['F-tokens-contrast', 'pass']]);
assertFixture('frontend-block-dual-framework', 'frontend-block-dual-framework', FRONTEND, [], 'BLOCK',
  [['F-dual-framework', 'fail']]);
assertFixture('frontend-block-dual-icons', 'frontend-block-dual-icons', FRONTEND, [], 'BLOCK',
  [['F-dual-icons', 'fail']]);
// Regression for mutant M8 (contrast threshold droppable to near-0 with
// tests still green): tokens present, genuinely below 4.5:1, must BLOCK.
assertFixture('frontend-block-low-contrast (tokens present, ratio 1.61)', 'frontend-block-low-contrast', FRONTEND, [], 'BLOCK',
  [['F-tokens-contrast', 'fail']]);
// The "no frontend detected" skip path had never been exercised.
assertFixture('frontend-no-ui (F-scope skip path)', 'frontend-no-ui', FRONTEND, [], 'SHIP',
  [['F-scope', 'pass']]);
// The "no package.json readable" not_evaluated branch had never been
// exercised — every prior frontend fixture had one.
assertFixture('frontend-no-package-json (F-dual-framework not_evaluated)', 'frontend-no-package-json', FRONTEND,
  [], 'CONDITIONAL', [['F-dual-framework', 'not_evaluated'], ['F-tokens-contrast', 'not_evaluated']]);

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
// Regression for mutant M7 on the acceptance side: PRODUCT.md present but
// missing a required heading must fail on the heading, not just on
// existence — "the file exists" and "the contract is complete" are
// different claims and the gate must not conflate them.
assertFixture('accept-block-thin-product (PRODUCT.md present, Constraints heading missing)', 'accept-block-thin-product', ACCEPT,
  ['--acceptor-context', 'separate'], 'BLOCK', [['A-product-contract', 'fail']]);
// Regression for mutant M10 (accept-check trusts a stale/planted on-disk
// report instead of re-running the producer): this fixture COMMITS a
// hand-written backend-report.json claiming verdict SHIP, while the real
// project state (dual ORM) should BLOCK. If accept-check ever reads that
// planted file instead of re-spawning check-backend.js fresh, this
// assertion is the one that catches it.
assertFixture('accept-poisoned-report (planted SHIP report must be ignored; real state BLOCKs)', 'accept-poisoned-report', ACCEPT,
  ['--acceptor-context', 'separate'], 'BLOCK', [['D-backend-engineering', 'fail']]);
// A-design-direction/A-ux-walkthrough had never been asserted failing —
// genuinely non-redundant, since check-frontend.js never looks at either
// document (it only checks design-tokens.json), so nothing else in the
// gate would have caught their absence.
assertFixture('accept-block-missing-design-docs (design-direction.md + ux-walkthrough.md both absent)', 'accept-block-missing-design-docs', ACCEPT,
  ['--acceptor-context', 'separate'], 'BLOCK',
  [['A-design-direction', 'fail'], ['A-ux-walkthrough', 'fail'], ['D-frontend', 'pass']]);
// D-frontend's own fail branch had never been proven to propagate through
// acceptance — only D-backend-engineering had a dedicated fixture for
// this. Docs are all fine here; only the re-run of check-frontend.js BLOCKs.
assertFixture('accept-block-frontend-dual (dual framework caught only by re-running check-frontend)', 'accept-block-frontend-dual', ACCEPT,
  ['--acceptor-context', 'separate'], 'BLOCK',
  [['D-frontend', 'fail'], ['A-design-direction', 'pass'], ['A-ux-walkthrough', 'pass']]);
// Proves accept-check's own direct document/heading check (A-architecture-doc)
// and systems-architecture's independent re-run (D-systems-architecture) agree
// when a required heading is missing — two separate code paths checking the
// same fact, verified not to have silently diverged.
assertFixture('accept-block-arch-heading (ARCHITECTURE.md present, Trust heading missing)', 'accept-block-arch-heading', ACCEPT,
  ['--acceptor-context', 'separate'], 'BLOCK',
  [['A-architecture-doc', 'fail'], ['D-systems-architecture', 'fail']]);

// Every emitted report must validate against the unified schema.
{
  const { validate } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'schema.cjs')));
  const schema = JSON.parse(read(path.join(root, 'core', 'schemas', 'check-report.schema.json')));
  const { report } = runFixture('accept-ship', ACCEPT, ['--acceptor-context', 'separate']);
  const errors = report ? validate(schema, report) : ['no report'];
  expect('acceptance report validates against check-report schema', errors.length === 0, errors.join('; '));
}

// ---------- 5. ai-prose-slop (skips only when vale is absent; CI installs vale) ----------
{
  const probe = spawnSync('vale', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.log('skip  ai-prose-slop fixtures: vale not installed (CI installs it; install locally to run these)');
  } else {
    const script = path.join(root, 'ai-prose-slop', 'scripts', 'check-prose.js');
    const clean = runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-clean', 'doc.md')]);
    const cleanReport = JSON.parse(clean.stdout);
    expect('ai-prose-slop: clean doc verdict SHIP', cleanReport.verdict === 'SHIP', cleanReport.verdict);
    const slop = runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-slop', 'doc.md')]);
    const slopReport = JSON.parse(slop.stdout);
    expect('ai-prose-slop: slop doc verdict CONDITIONAL', slopReport.verdict === 'CONDITIONAL', slopReport.verdict);
    const ids = new Set(slopReport.checks.map((c) => c.id));
    for (const rule of ['AIProseTells.InflatedVocabulary', 'AIProseTells.ThroatClearing', 'AIProseTells.WeaselAttribution',
      'AIProseTells.ImportanceInflation', 'AIProseTells.SummaryRecap', 'AIProseTells.EmDashOveruse',
      'AIProseTells.UnsupportedSuperlative', 'AIProseTells.ParallelFlourish']) {
      expect(`ai-prose-slop: rule fires ${rule}`, ids.has(rule), [...ids].join(', '));
    }
    // Regression: patterns.md claimed "robust" was Vale-checkable while the
    // yml never listed it — the fixture's "robust platform" went unflagged.
    const flaggedTokens = slopReport.checks
      .filter((c) => c.id === 'AIProseTells.InflatedVocabulary')
      .map((c) => (c.detail.match(/'([^']+)'/) || [])[1]);
    expect('ai-prose-slop: "robust" is caught by InflatedVocabulary (doc/rule drift regression)',
      flaggedTokens.includes('robust'), flaggedTokens.join(', '));

    // The following were verified by hand once and never captured as a
    // regression test — automating exactly what was manually exercised.
    const strictClean = runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-clean', 'doc.md'), '--strict']);
    expect('ai-prose-slop: --strict on clean doc exits 0', strictClean.status === 0, `exit ${strictClean.status}`);
    const strictSlop = runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-slop', 'doc.md'), '--strict']);
    expect('ai-prose-slop: --strict on slop doc exits 1', strictSlop.status === 1, `exit ${strictSlop.status}`);

    const dirTarget = runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-slop')]);
    let dirReport = null;
    try { dirReport = JSON.parse(dirTarget.stdout); } catch { /* asserted below */ }
    expect('ai-prose-slop: directory target works', dirReport?.verdict === 'CONDITIONAL', dirTarget.stderr || dirTarget.stdout);

    const reportPath = path.join(tmpBase, 'ai-prose-slop-report-test.json');
    runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-clean', 'doc.md'), '--report', reportPath]);
    expect('ai-prose-slop: --report writes a readable report file',
      fs.existsSync(reportPath) && JSON.parse(read(reportPath)).verdict === 'SHIP', 'report file missing or malformed');

    const multiTarget = runNode(script, [
      path.join(root, 'fixtures', 'ai-prose-slop-clean', 'doc.md'),
      path.join(root, 'fixtures', 'ai-prose-slop-slop', 'doc.md'),
    ]);
    let multiReport = null;
    try { multiReport = JSON.parse(multiTarget.stdout); } catch { /* asserted below */ }
    expect('ai-prose-slop: multiple targets in one invocation', multiReport?.verdict === 'CONDITIONAL', multiTarget.stderr || multiTarget.stdout);

    // The `--` separator (added as hardening) must actually stop a target
    // whose name starts with "-" from being parsed as a vale flag.
    const dashPath = path.join(tmpBase, '--strict');
    fs.copyFileSync(path.join(root, 'fixtures', 'ai-prose-slop-clean', 'doc.md'), dashPath);
    const dashTarget = runNode(script, [dashPath]);
    let dashReport = null;
    try { dashReport = JSON.parse(dashTarget.stdout); } catch { /* asserted below */ }
    expect('ai-prose-slop: a target literally named "--strict" is treated as a path, not a flag',
      dashReport?.verdict === 'SHIP', dashTarget.stderr || dashTarget.stdout);

    // Regression: a vale execution error (bad config, an invalid yml key —
    // this exact scenario broke the whole style while adding
    // UnsupportedSuperlative/ParallelFlourish) must BLOCK loudly, never be
    // swallowed as "vale ran clean with zero findings" via
    // `JSON.parse(emptyStdout || '{}')`.
    const brokenRulePath = path.join(root, 'ai-prose-slop', 'rules', 'AIProseTells', 'ParallelFlourish.yml');
    const goodRule = read(brokenRulePath);
    try {
      fs.writeFileSync(brokenRulePath, 'extends: existence\nmessage: "test"\nexample: "an invalid top-level key"\ntokens:\n  - test\n');
      const crashed = runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-clean', 'doc.md')]);
      let crashedReport = null;
      try { crashedReport = JSON.parse(crashed.stdout); } catch { /* asserted below */ }
      expect('ai-prose-slop: a vale config error BLOCKs instead of silently reporting SHIP',
        crashedReport?.verdict === 'BLOCK' && crashedReport.checks[0]?.id === 'vale-crashed',
        JSON.stringify(crashedReport));

      // The same invalid key should also be caught statically at generation
      // time, before it ever reaches vale.
      const genResult = runNode(path.join(root, 'ai-prose-slop', 'scripts', 'gen-patterns.mjs'), []);
      expect('gen-patterns.mjs: rejects a real (non-example-comment) invalid yml key at generation time',
        genResult.status !== 0 && (genResult.stderr || '').includes('not a real vale key'),
        (genResult.stderr || '').slice(0, 200));
    } finally {
      fs.writeFileSync(brokenRulePath, goodRule);
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

// ---------- 6b. ai-prose-slop patterns.md <-> Vale rule drift ----------
// No vale binary needed for this — it's pure text generation/diffing, so it
// runs unconditionally rather than being gated behind the vale-presence
// check in section 5.
{
  const r = runNode(path.join(root, 'ai-prose-slop', 'scripts', 'gen-patterns.mjs'), ['--check']);
  expect('ai-prose-slop/references/patterns.md matches rules/AIProseTells/*.yml', r.status === 0, (r.stderr || '').trim());
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

// ---------- 8. Pre-commit secret-scanning hook ----------
// Extensionless (git looks up hooks by exact name "pre-commit"), so it's
// invisible to section 1's extension-filtered syntax walk — checked
// explicitly here instead. Functional test actually inits a git repo,
// stages real content, and runs the hook against it, rather than only
// exercising SECRET_PATTERNS directly (which check-backend.js already does)
// — this proves the hook's OWN plumbing (git diff --cached, git show
// :path, exit code) works, not just the shared pattern list.
{
  const hookPath = path.join(root, 'scripts', 'git-hooks', 'pre-commit');
  const syntaxCheck = spawnSync(process.execPath, ['--check', hookPath], { encoding: 'utf8' });
  expect('syntax scripts/git-hooks/pre-commit', syntaxCheck.status === 0, (syntaxCheck.stderr || '').split('\n')[0]);

  const hookRepo = fs.mkdtempSync(path.join(tmpBase, 'hook-repo-'));
  const git = (args) => spawnSync('git', args, { cwd: hookRepo, encoding: 'utf8' });
  git(['init', '-q']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'Test']);

  fs.writeFileSync(path.join(hookRepo, 'app.js'), 'const key = "sk_live_abcdefghijklmnop1234";\n');
  git(['add', 'app.js']);
  const blocked = spawnSync(process.execPath, [hookPath], { cwd: hookRepo, encoding: 'utf8' });
  expect('pre-commit hook: blocks a staged Stripe-shaped key', blocked.status === 1, `exit ${blocked.status}: ${blocked.stderr}`);
  expect('pre-commit hook: reports the path, never the value',
    blocked.stderr.includes('app.js') && !blocked.stderr.includes('sk_live_'), blocked.stderr);

  git(['reset']);
  fs.writeFileSync(path.join(hookRepo, 'app.js'), 'const greeting = "hello";\n');
  git(['add', 'app.js']);
  const clean = spawnSync(process.execPath, [hookPath], { cwd: hookRepo, encoding: 'utf8' });
  expect('pre-commit hook: allows a clean staged file', clean.status === 0, `exit ${clean.status}: ${clean.stderr}`);

  // Regression: must check the STAGED blob, not the working-tree file — a
  // partially-staged edit (git add -p leaving unstaged changes on disk)
  // must be judged on what's actually about to be committed.
  fs.writeFileSync(path.join(hookRepo, 'app.js'), 'const key = "sk_live_abcdefghijklmnop1234";\n');
  const stagedVsWorktree = spawnSync(process.execPath, [hookPath], { cwd: hookRepo, encoding: 'utf8' });
  expect('pre-commit hook: judges the staged blob, not unstaged working-tree edits',
    stagedVsWorktree.status === 0, `exit ${stagedVsWorktree.status}: ${stagedVsWorktree.stderr}`);
}

fs.rmSync(tmpBase, { recursive: true, force: true });
console.log(failures === 0 ? '\nAll tests passed.' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
