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
  for (const [harness, hPaths] of Object.entries(registry.harnessPaths)) {
    const list = Array.isArray(hPaths) ? hPaths : [hPaths];
    expect(`registry: harnessPaths.${harness} is a non-empty string or array of strings`,
      list.length > 0 && list.every((p) => typeof p === 'string' && p.startsWith('~')));
  }
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
// multiPart generalized beyond Node: a Python Flask backend (requirements.txt,
// no package.json at all) plus a public/index.html frontend signal must be
// recognized as multi-part exactly like an Express+React app would be.
assertFixture('multipart-python-frontend (multiPart detected with zero package.json)', 'multipart-python-frontend', ARCH, [], 'BLOCK',
  [['P-arch-doc', 'fail']]);

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

// classify.cjs's manifest detection generalized beyond package.json — these
// four fixtures prove it, not just assert it. Before this, a Python/Go
// backend with no package.json hit B-scope's "no server detected" skip
// unconditionally, silently never running B-dual-orm/B-client-secrets.
assertFixture('backend-python-ship (Flask + SQLAlchemy via requirements.txt)', 'backend-python-ship', BACKEND, [], 'SHIP',
  [['B-dual-orm', 'pass']]);
assertFixture('backend-python-dual-orm (SQLAlchemy + peewee in one requirements.txt)', 'backend-python-dual-orm', BACKEND, [], 'BLOCK',
  [['B-dual-orm', 'fail']]);
assertFixture('backend-go-ship (Gin via go.mod, module path matched not a short name)', 'backend-go-ship', BACKEND, [], 'SHIP',
  [['B-dual-orm', 'pass']]);
// Django bundles its own ORM (no separate package to declare) and is a
// fullstack framework like Next.js — single-part on its own, same
// treatment, now proven for a second ecosystem, not just Node's.
assertFixture('backend-django-solo (fullstack framework, not forced multi-part)', 'backend-django-solo', BACKEND, [], 'SHIP',
  [['B-arch-doc', 'pass'], ['B-dual-orm', 'pass']]);
assertFixture('multipart-python-frontend (B-arch-doc fail, same fixture as the systems-architecture regression)', 'multipart-python-frontend', BACKEND, [], 'BLOCK',
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

// ---------- 4b. code-organization (circular-import detector; no vale needed) ----------
{
  const ORG = path.join(root, 'code-organization', 'scripts', 'check-organization.js');

  const clean = runNode(ORG, ['--root', path.join(root, 'fixtures', 'code-organization-clean')]);
  let cleanReport = null;
  try { cleanReport = JSON.parse(clean.stdout); } catch { /* asserted below */ }
  expect('code-organization: clean two-file chain verdict SHIP', cleanReport?.verdict === 'SHIP', clean.stdout || clean.stderr);
  expect('code-organization: clean exit code 0', clean.status === 0, `exit ${clean.status}`);

  const circular = runNode(ORG, ['--root', path.join(root, 'fixtures', 'code-organization-circular')]);
  let circularReport = null;
  try { circularReport = JSON.parse(circular.stdout); } catch { /* asserted below */ }
  expect('code-organization: a->b->c->a verdict BLOCK', circularReport?.verdict === 'BLOCK', circular.stdout || circular.stderr);
  expect('code-organization: exit code 1', circular.status === 1, `exit ${circular.status}`);
  const cycleCheck = circularReport?.checks.find((c) => c.id === 'O-circular-deps');
  expect('code-organization: reports the actual cycle chain',
    Boolean(cycleCheck) && cycleCheck.status === 'fail' &&
    /a\.js -> .*b\.js -> .*c\.js -> .*a\.js/.test(cycleCheck.detail), cycleCheck?.detail);

  // Regression: a real bug caught before this checker ever shipped — `known`
  // held relative paths while resolveSpecifier builds absolute ones, so the
  // Set lookup never matched and no edge was ever added to the graph. This
  // fixture is the one that would silently pass (SHIP on a real 3-file
  // cycle) if that regressed.
  expect('code-organization: circular fixture is not silently reported clean (regression)',
    circularReport?.verdict !== 'SHIP', JSON.stringify(circularReport));

  // Regression: `import type` is erased at compile time and creates no
  // runtime cycle — flagging it would be a false positive on an idiomatic
  // TS pattern (two modules whose types reference each other).
  const typeOnly = runNode(ORG, ['--root', path.join(root, 'fixtures', 'code-organization-typeonly-clean')]);
  let typeOnlyReport = null;
  try { typeOnlyReport = JSON.parse(typeOnly.stdout); } catch { /* asserted below */ }
  expect('code-organization: type-only mutual imports are not flagged as a cycle',
    typeOnlyReport?.verdict === 'SHIP', typeOnly.stdout || typeOnly.stderr);

  const noCode = runNode(ORG, ['--root', path.join(root, 'fixtures', 'code-organization-no-code')]);
  let noCodeReport = null;
  try { noCodeReport = JSON.parse(noCode.stdout); } catch { /* asserted below */ }
  expect('code-organization: no JS/TS files (O-scope skip path)',
    noCodeReport?.verdict === 'SHIP' && noCodeReport.checks[0]?.id === 'O-scope', JSON.stringify(noCodeReport));
}

// ---------- 4c. code-smells (file size + nesting depth; no vale needed) ----------
// Deliberately exercises MULTIPLE languages, not just JS/TS — this checker
// was specifically corrected mid-build to not assume every codebase it
// reviews is JavaScript, and these fixtures are what prove that correction
// actually holds rather than just being asserted in a comment.
{
  const SMELLS = path.join(root, 'code-smells', 'scripts', 'check-smells.js');

  const clean = runNode(SMELLS, ['--root', path.join(root, 'fixtures', 'code-smells-clean')]);
  let cleanReport = null;
  try { cleanReport = JSON.parse(clean.stdout); } catch { /* asserted below */ }
  expect('code-smells: clean mixed JS+Python fixture verdict SHIP', cleanReport?.verdict === 'SHIP', clean.stdout || clean.stderr);
  expect('code-smells: exit code 0', clean.status === 0, `exit ${clean.status}`);

  // The large-file check is language-agnostic on purpose: a 400+ line
  // Python file must be caught exactly like a 400+ line JS file would be.
  const largeFile = runNode(SMELLS, ['--root', path.join(root, 'fixtures', 'code-smells-large-file')]);
  let largeFileReport = null;
  try { largeFileReport = JSON.parse(largeFile.stdout); } catch { /* asserted below */ }
  expect('code-smells: large Python file verdict BLOCK (language-agnostic size check)',
    largeFileReport?.verdict === 'BLOCK', largeFile.stdout || largeFile.stderr);
  const largeCheck = largeFileReport?.checks.find((c) => c.id === 'S-large-file');
  expect('code-smells: S-large-file fails on the .py file specifically',
    largeCheck?.status === 'fail' && largeCheck.detail.includes('big.py'), largeCheck?.detail);
  expect('code-smells: S-deep-nesting correctly not_applicable for an all-Python project',
    largeFileReport?.checks.find((c) => c.id === 'S-deep-nesting')?.status === 'pass');

  const deepNesting = runNode(SMELLS, ['--root', path.join(root, 'fixtures', 'code-smells-deep-nesting')]);
  let deepNestingReport = null;
  try { deepNestingReport = JSON.parse(deepNesting.stdout); } catch { /* asserted below */ }
  expect('code-smells: deep JS nesting verdict BLOCK', deepNestingReport?.verdict === 'BLOCK', deepNesting.stdout || deepNesting.stderr);
  const nestingCheck = deepNestingReport?.checks.find((c) => c.id === 'S-deep-nesting');
  expect('code-smells: reports the specific depth and location',
    nestingCheck?.status === 'fail' && /depth 6.*deep\.js:6/.test(nestingCheck.detail), nestingCheck?.detail);

  // Regression: Go is deliberately excluded from the brace-nesting check
  // (its backtick raw strings don't process backslash escapes the way
  // stripStringsAndComments assumes) — equally deep .go nesting must NOT
  // be flagged, proving the exclusion is real and not just documented.
  const goExcluded = runNode(SMELLS, ['--root', path.join(root, 'fixtures', 'code-smells-go-excluded')]);
  let goExcludedReport = null;
  try { goExcludedReport = JSON.parse(goExcluded.stdout); } catch { /* asserted below */ }
  expect('code-smells: equally deep .go nesting is NOT flagged (Go excluded from S-deep-nesting)',
    goExcludedReport?.verdict === 'SHIP', JSON.stringify(goExcludedReport));

  const noCodeSmells = runNode(SMELLS, ['--root', path.join(root, 'fixtures', 'code-smells-no-code')]);
  let noCodeSmellsReport = null;
  try { noCodeSmellsReport = JSON.parse(noCodeSmells.stdout); } catch { /* asserted below */ }
  expect('code-smells: no source files (S-scope skip path)',
    noCodeSmellsReport?.verdict === 'SHIP' && noCodeSmellsReport.checks[0]?.id === 'S-scope', JSON.stringify(noCodeSmellsReport));
}

// ---------- 4d. data-modeling (SQL migration-safety checker; a narrow slice, not "all of data modeling") ----------
{
  const MIGRATIONS = path.join(root, 'data-modeling', 'scripts', 'check-migrations.js');

  const clean = runNode(MIGRATIONS, ['--root', path.join(root, 'fixtures', 'data-modeling-clean')]);
  let cleanReport = null;
  try { cleanReport = JSON.parse(clean.stdout); } catch { /* asserted below */ }
  expect('data-modeling: clean fixture verdict SHIP (comment/string mentions of DROP/RENAME ignored)',
    cleanReport?.verdict === 'SHIP', clean.stdout || clean.stderr);
  expect('data-modeling: exit code 0', clean.status === 0, `exit ${clean.status}`);

  const destructive = runNode(MIGRATIONS, ['--root', path.join(root, 'fixtures', 'data-modeling-destructive')]);
  let destructiveReport = null;
  try { destructiveReport = JSON.parse(destructive.stdout); } catch { /* asserted below */ }
  expect('data-modeling: DROP TABLE/COLUMN verdict BLOCK', destructiveReport?.verdict === 'BLOCK', destructive.stdout || destructive.stderr);
  expect('data-modeling: DM-sql-destructive-drop is the specific failing check',
    destructiveReport?.checks.find((c) => c.id === 'DM-sql-destructive-drop')?.status === 'fail');

  const unsafe = runNode(MIGRATIONS, ['--root', path.join(root, 'fixtures', 'data-modeling-unsafe-notnull')]);
  let unsafeReport = null;
  try { unsafeReport = JSON.parse(unsafe.stdout); } catch { /* asserted below */ }
  expect('data-modeling: unsafe-notnull fixture verdict BLOCK', unsafeReport?.verdict === 'BLOCK', unsafe.stdout || unsafe.stderr);
  expect('data-modeling: DM-sql-unsafe-not-null fails (ADD COLUMN NOT NULL, no DEFAULT)',
    unsafeReport?.checks.find((c) => c.id === 'DM-sql-unsafe-not-null')?.status === 'fail');
  expect('data-modeling: DM-sql-rename fails (RENAME COLUMN in the same file)',
    unsafeReport?.checks.find((c) => c.id === 'DM-sql-rename')?.status === 'fail');
  expect('data-modeling: DM-sql-volatile-default fails (ADD COLUMN DEFAULT gen_random_uuid())',
    unsafeReport?.checks.find((c) => c.id === 'DM-sql-volatile-default')?.status === 'fail');

  // Regression: down/rollback migrations are EXPECTED to contain drops and
  // reversals by design — both the .down.sql filename convention and an
  // inline `-- +goose Down` marker must be excluded, or a normal rollback
  // file would permanently BLOCK the project.
  const downExcluded = runNode(MIGRATIONS, ['--root', path.join(root, 'fixtures', 'data-modeling-down-excluded')]);
  let downExcludedReport = null;
  try { downExcludedReport = JSON.parse(downExcluded.stdout); } catch { /* asserted below */ }
  expect('data-modeling: down migrations (.down.sql AND goose-style inline marker) are excluded, verdict SHIP',
    downExcludedReport?.verdict === 'SHIP', JSON.stringify(downExcludedReport));

  const noSql = runNode(MIGRATIONS, ['--root', path.join(root, 'fixtures', 'data-modeling-no-sql')]);
  let noSqlReport = null;
  try { noSqlReport = JSON.parse(noSql.stdout); } catch { /* asserted below */ }
  expect('data-modeling: no .sql files (DM-sql-scope skip path — e.g. an ORM-schema or NoSQL project)',
    noSqlReport?.verdict === 'SHIP' && noSqlReport.checks[0]?.id === 'DM-sql-scope', JSON.stringify(noSqlReport));
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

// ---------- 8. Pre-commit secret-scanning hook (skips only when gitleaks is absent) ----------
// Node, shelling out to `gitleaks` — Node is already a de facto
// prerequisite for the coding-agent harnesses this suite targets, and
// gitleaks is a real, maintained secret-detection tool this suite doesn't
// try to reimplement (same "use the real tool" choice as vale for
// ai-prose-slop). Functional tests actually init a git repo, stage real
// content, and run the hook against it — proving the hook's OWN plumbing
// (gitleaks invocation, report parsing, exit code), not just that gitleaks
// itself works in isolation.
{
  const hookPath = path.join(root, 'scripts', 'git-hooks', 'pre-commit');
  const syntaxCheck = spawnSync(process.execPath, ['--check', hookPath], { encoding: 'utf8' });
  expect('syntax scripts/git-hooks/pre-commit', syntaxCheck.status === 0, (syntaxCheck.stderr || '').split('\n')[0]);

  const gitleaksProbe = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  if (gitleaksProbe.error || gitleaksProbe.status !== 0) {
    console.log('skip  pre-commit hook fixtures: gitleaks not installed (CI installs it; install locally to run these)');
  } else {
    const hookRepo = fs.mkdtempSync(path.join(tmpBase, 'hook-repo-'));
    const git = (args) => spawnSync('git', args, { cwd: hookRepo, encoding: 'utf8' });
    git(['init', '-q']);
    git(['config', 'user.email', 'test@example.com']);
    git(['config', 'user.name', 'Test']);
    const run = () => spawnSync(process.execPath, [hookPath], { cwd: hookRepo, encoding: 'utf8' });

    fs.writeFileSync(path.join(hookRepo, 'app.js'), 'const key = "sk_live_REDACTED_TEST_PLACEHOLDER";\n');
    git(['add', 'app.js']);
    const blocked = run();
    expect('pre-commit hook: blocks a staged Stripe-shaped key', blocked.status === 1, `exit ${blocked.status}: ${blocked.stderr}`);
    expect('pre-commit hook: reports the path and rule, never the value',
      blocked.stderr.includes('app.js') && blocked.stderr.includes('stripe') && !blocked.stderr.includes('sk_live_REDACTED_TEST_PLACEHOLDER'),
      blocked.stderr);

    git(['reset']);
    fs.writeFileSync(path.join(hookRepo, 'app.js'), 'const key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890";\n');
    git(['add', 'app.js']);
    const blockedExtra = run();
    expect('pre-commit hook: blocks an Anthropic-shaped key (core/gitleaks-extra.toml pass)',
      blockedExtra.status === 1 && blockedExtra.stderr.includes('anthropic'), `exit ${blockedExtra.status}: ${blockedExtra.stderr}`);

    git(['reset']);
    fs.writeFileSync(path.join(hookRepo, 'app.js'), 'const greeting = "hello";\n');
    git(['add', 'app.js']);
    const clean = run();
    expect('pre-commit hook: allows a clean staged file', clean.status === 0, `exit ${clean.status}: ${clean.stderr}`);

    // Regression: v0.4's hand-rolled scanner BLOCKed on the bare phrase
    // "task-management" with no real key prefix — gitleaks' own anchored
    // rules shouldn't reproduce that false positive.
    fs.writeFileSync(path.join(hookRepo, 'app2.js'), 'const feature = "task-management-app";\n');
    git(['add', 'app2.js']);
    const notASecret = run();
    expect('pre-commit hook: "task-management" is not a secret', notASecret.status === 0, `exit ${notASecret.status}: ${notASecret.stderr}`);

    // Regression: must check the STAGED blob, not the working-tree file —
    // `gitleaks protect --staged` is documented to do this; asserted here
    // so a future flag change can't silently regress it unnoticed.
    git(['reset']);
    fs.writeFileSync(path.join(hookRepo, 'app.js'), 'const greeting = "hello";\n');
    git(['add', 'app.js']);
    fs.writeFileSync(path.join(hookRepo, 'app.js'), 'const key = "sk_live_REDACTED_TEST_PLACEHOLDER";\n');
    const stagedVsWorktree = run();
    expect('pre-commit hook: judges the staged blob, not unstaged working-tree edits',
      stagedVsWorktree.status === 0, `exit ${stagedVsWorktree.status}: ${stagedVsWorktree.stderr}`);
  }
}

// ---------- 9. Installer: array-valued harnessPaths (codex installs to two dirs) ----------
// codex is the one harness with a multi-path entry (registry.json's
// _harnessPathsNote explains why) — this proves install.mjs actually
// expands it to multiple targets rather than silently installing to only
// the first, which no other test here would catch (every other harness is
// a single string and wouldn't exercise the Array.isArray branch at all).
{
  const fakeHome = fs.mkdtempSync(path.join(tmpBase, 'installer-fakehome-'));
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'install.mjs'), '--harness', 'codex', '--skill', 'mental-models'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome } });
  expect('install.mjs --harness codex: exits 0', r.status === 0, r.stderr || r.stdout);
  expect('install.mjs --harness codex: installs to ~/.codex/skills',
    fs.existsSync(path.join(fakeHome, '.codex', 'skills', 'mental-models', 'SKILL.md')));
  expect('install.mjs --harness codex: installs to ~/.agents/skills',
    fs.existsSync(path.join(fakeHome, '.agents', 'skills', 'mental-models', 'SKILL.md')));
  expect('install.mjs --harness codex: reports 2 target(s)', /2 target\(s\)/.test(r.stdout), r.stdout);
}

// ---------- 9b. INSTALLED skills must actually run ----------
// Every other test in this file runs checkers from the DEV CHECKOUT, where
// core.lib resolves to core/lib and sibling files under core/ are reachable.
// An installed skill resolves core.lib to scripts/vendor/lib instead, so
// anything under core/ that install.mjs forgets to vendor is missing at
// runtime — and no dev-checkout test can ever see it.
//
// This gap shipped a real bug: core/gitleaks-extra.toml was not vendored, so
// EVERY installed check-backend run failed with "unable to load gitleaks
// config" — an unconditional BLOCK on every project, while this suite stayed
// green. Asserting a specific missing file would only re-pin that one bug, so
// the check below is deliberately generic: install, then run, and require the
// checker to reach a real verdict.
{
  const dest = fs.mkdtempSync(path.join(tmpBase, 'installed-'));
  const inst = spawnSync(process.execPath,
    [path.join(root, 'scripts', 'install.mjs'), '--dest', dest, '--skill', 'backend-engineering'],
    { cwd: root, encoding: 'utf8' });
  expect('install.mjs --dest: exits 0', inst.status === 0, inst.stderr || inst.stdout);

  // Every regular file directly under core/ must reach the vendored core.
  // Directory-by-directory vendoring is what silently dropped gitleaks-extra.toml.
  const vendor = path.join(dest, 'backend-engineering', 'scripts', 'vendor');
  for (const entry of fs.readdirSync(path.join(root, 'core'), { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    expect(`install.mjs vendors core/${entry.name}`, fs.existsSync(path.join(vendor, entry.name)));
  }

  // Run the INSTALLED checker against a clean, minimal server project.
  const proj = fs.mkdtempSync(path.join(tmpBase, 'installed-proj-'));
  fs.writeFileSync(path.join(proj, 'package.json'), '{"dependencies":{"express":"^4.0.0"}}\n');
  fs.writeFileSync(path.join(proj, 'server.js'), 'module.exports = {};\n');
  const run = spawnSync(process.execPath,
    [path.join(dest, 'backend-engineering', 'scripts', 'check-backend.js'), '--root', proj, '--no-write'],
    { encoding: 'utf8' });
  let installedReport = null;
  try { installedReport = JSON.parse(run.stdout); } catch { /* asserted below */ }
  expect('installed check-backend: emits a parseable report', installedReport !== null,
    (run.stderr || run.stdout || '').slice(0, 300));
  if (installedReport) {
    const secrets = installedReport.checks.find((c) => c.id === 'B-client-secrets');
    // The tool itself may legitimately be absent locally (=> not_evaluated).
    // What must never happen is the checker failing because its OWN install
    // is incomplete — that's a broken product, not a finding about the project.
    expect('installed check-backend: does not fail on its own missing config',
      Boolean(secrets) && !/did not complete normally|unable to load/i.test(secrets.detail),
      secrets ? secrets.detail.slice(0, 200) : 'B-client-secrets check absent');
    expect('installed check-backend: clean project is not BLOCKed',
      installedReport.verdict !== 'BLOCK', JSON.stringify(installedReport.checks));
  }
}

// ---------- 10. A --root that cannot be read is never a pass ----------
// Every checker's file walk swallows readdirSync errors, so a nonexistent or
// unreadable --root produced "zero files found" -> "not applicable" -> pass ->
// SHIP, exit 0, on all six checkers. A typo'd path in CI was indistinguishable
// from a clean codebase — the precise failure the suite's own contract
// ("missing evidence can never read as success") exists to forbid.
//
// This is NOT the same as "scanned fine, found no server" — that remains a
// legitimate pass. The distinction under test is readable-but-empty vs.
// unreadable.
{
  const missing = path.join(tmpBase, 'no-such-project-dir');
  const CHECKERS = [
    ['systems-architecture', ARCH],
    ['frontend', FRONTEND],
    ['backend-engineering', BACKEND],
    ['product-acceptance', ACCEPT],
    ['code-organization', 'code-organization/scripts/check-organization.js'],
    ['code-smells', 'code-smells/scripts/check-smells.js'],
    ['data-modeling', 'data-modeling/scripts/check-migrations.js'],
  ];
  for (const [name, script] of CHECKERS) {
    const r = runNode(path.join(root, ...script.split('/')), ['--root', missing, '--no-write']);
    let rep = null;
    try { rep = JSON.parse(r.stdout); } catch { /* a hard exit with no JSON is also acceptable */ }
    expect(`${name}: unreadable --root does not exit 0`, r.status !== 0, `exit ${r.status}: ${r.stdout.slice(0, 160)}`);
    expect(`${name}: unreadable --root does not report SHIP`,
      rep === null || rep.verdict !== 'SHIP', JSON.stringify(rep && rep.checks));
  }

  // A readable directory with no signals must still be a legitimate pass —
  // proving the fix above discriminates rather than just blanket-failing.
  const emptyProj = fs.mkdtempSync(path.join(tmpBase, 'genuinely-empty-'));
  fs.writeFileSync(path.join(emptyProj, 'notes.txt'), 'no code here\n');
  const okRun = runNode(path.join(root, ...BACKEND.split('/')), ['--root', emptyProj, '--no-write']);
  expect('backend-engineering: readable-but-empty project is still a clean pass',
    okRun.status === 0, `exit ${okRun.status}: ${okRun.stdout.slice(0, 200)}`);
}

// ---------- 10b. An empty checks array is not a ship ----------
// computeVerdict([]) returned SHIP and the report schema had no minItems, so a
// producer that emitted zero checks — because it crashed early, was gutted, or
// short-circuited — was recorded by accept-check as a passing producer.
{
  const { computeVerdict } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'report.cjs')));
  expect('computeVerdict([]) is not SHIP', computeVerdict([]) !== 'SHIP', computeVerdict([]));

  const { validate } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'schema.cjs')));
  const schema = JSON.parse(read(path.join(root, 'core', 'schemas', 'check-report.schema.json')));
  const emptyReport = {
    schemaVersion: 1, skill: 'x', generatedAt: '2026-01-01T00:00:00Z', root: '/', verdict: 'SHIP', checks: [],
  };
  expect('report schema rejects an empty checks array', validate(schema, emptyReport).length > 0);
}

// ---------- 10c. core/gitleaks-extra.toml must not fire on documentation ----------
// The two supplementary rules (Anthropic / OpenAI project keys, which gitleaks'
// default ruleset does not cover as of 8.30.1) were bare prefix regexes with no
// entropy floor and no allowlist. Result: any repo whose docs SHOW the key
// format — "keys look like sk-ant-api03-YOUR-KEY-HERE" — was BLOCKed, while
// upstream gitleaks correctly ignored the same line. That's a false positive on
// exactly the projects this suite targets (LLM tooling), and a gate that cries
// wolf is a gate people disable.
//
// The realistic key is generated at RUNTIME, never stored as a literal: a
// high-entropy sk-ant- string committed to this repo would trip the suite's own
// pre-commit hook.
{
  const probe = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.log('skip  gitleaks-extra.toml precision tests: gitleaks not installed');
  } else {
    const crypto = await import('node:crypto');
    const entropicTail = crypto.randomBytes(72).toString('base64url').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 95);
    const proj = fs.mkdtempSync(path.join(tmpBase, 'gitleaks-precision-'));
    fs.writeFileSync(path.join(proj, 'package.json'), '{"dependencies":{"express":"^4.0.0"}}\n');
    fs.writeFileSync(path.join(proj, 'server.js'), 'module.exports = {};\n');
    // TRUE POSITIVE: a realistic, high-entropy key.
    fs.writeFileSync(path.join(proj, 'leak.js'), `const k = "${'sk-ant-' + 'api03-' + entropicTail}";\n`);
    const leakRun = runNode(path.join(root, ...BACKEND.split('/')), ['--root', proj, '--no-write']);
    let leakRep = null;
    try { leakRep = JSON.parse(leakRun.stdout); } catch { /* asserted below */ }
    expect('gitleaks-extra: a realistic Anthropic key is still caught',
      leakRep && leakRep.checks.find((c) => c.id === 'B-client-secrets')?.status === 'fail',
      JSON.stringify(leakRep && leakRep.checks));

    // FALSE POSITIVE GUARD: docs describing the format, and a benign URL slug
    // sharing the prefix. Neither is a credential.
    fs.rmSync(path.join(proj, 'leak.js'));
    fs.writeFileSync(path.join(proj, 'README.md'),
      '# Setup\n\nSet ANTHROPIC_API_KEY. Keys look like sk-ant-api03-YOUR-KEY-HERE.\n');
    fs.writeFileSync(path.join(proj, 'cdn.js'),
      'const u = "https://cdn.acme.io/assets/sk-ant-theme-bundle-v2";\n');
    fs.writeFileSync(path.join(proj, 'ci.sh'), 'KEY=sk-proj-CI_PLACEHOLDER_TOKEN_1234\n');
    const cleanRun = runNode(path.join(root, ...BACKEND.split('/')), ['--root', proj, '--no-write']);
    let cleanRep = null;
    try { cleanRep = JSON.parse(cleanRun.stdout); } catch { /* asserted below */ }
    const cleanSecrets = cleanRep && cleanRep.checks.find((c) => c.id === 'B-client-secrets');
    expect('gitleaks-extra: documentation placeholders do not BLOCK',
      Boolean(cleanSecrets) && cleanSecrets.status === 'pass',
      cleanSecrets ? cleanSecrets.detail.slice(0, 220) : JSON.stringify(cleanRep));
  }
}

// ---------- 10d. Acceptance must not trust a producer's self-declared verdict ----------
// accept-check re-runs producers rather than reading their JSON off disk — but
// it then branched on report.verdict, a value the producer wrote about itself.
// That reintroduces the trust the design exists to remove, one level down: a
// producer emitting {verdict:'SHIP', checks:[{status:'fail'}]} was recorded as
// a passing producer with the failing check in hand.
//
// Built as a minimal temp suite (core + registry + product-acceptance + one
// stub producer) so a lying producer can be exercised without touching the repo.
{
  const suite = fs.mkdtempSync(path.join(tmpBase, 'lying-producer-suite-'));
  fs.cpSync(path.join(root, 'core'), path.join(suite, 'core'), { recursive: true });
  fs.copyFileSync(path.join(root, 'registry.json'), path.join(suite, 'registry.json'));
  fs.cpSync(path.join(root, 'product-acceptance'), path.join(suite, 'product-acceptance'), { recursive: true });

  // Stub frontend producer: claims SHIP while reporting a failing check.
  const stubDir = path.join(suite, 'frontend', 'scripts');
  fs.mkdirSync(stubDir, { recursive: true });
  fs.writeFileSync(path.join(stubDir, 'check-frontend.js'),
    'console.log(JSON.stringify({schemaVersion:1,skill:"frontend",generatedAt:"2026-01-01T00:00:00Z",' +
    'root:"/",verdict:"SHIP",checks:[{id:"F-boom",status:"fail",detail:"deliberate disagreement"}]}));\n');

  const proj = fs.mkdtempSync(path.join(tmpBase, 'lying-producer-proj-'));
  fs.mkdirSync(path.join(proj, 'public'), { recursive: true });
  fs.writeFileSync(path.join(proj, 'public', 'index.html'), '<!doctype html><html></html>\n');
  fs.writeFileSync(path.join(proj, 'PRODUCT.md'),
    '# P\n\n## Purpose\nx\n\n## Users\nx\n\n## Success\nx\n\n## MVP\nx\n\n## Constraints\nx\n');

  const r = runNode(path.join(suite, 'product-acceptance', 'scripts', 'accept-check.js'),
    ['--root', proj, '--no-write', '--acceptor-context', 'separate']);
  let rep = null;
  try { rep = JSON.parse(r.stdout); } catch { /* asserted below */ }
  const dFrontend = rep && rep.checks.find((c) => c.id === 'D-frontend');
  expect('acceptance: a producer claiming SHIP with a failing check is not recorded as pass',
    Boolean(dFrontend) && dFrontend.status !== 'pass',
    dFrontend ? `${dFrontend.status}: ${dFrontend.detail}` : JSON.stringify(rep && rep.checks));
  expect('acceptance: overall verdict is not SHIP when a producer lied',
    rep && rep.verdict !== 'SHIP', rep && rep.verdict);
}

// ---------- 10e. The audited repo must not be able to disable its own scan ----------
// product-acceptance is the skill most likely to run standalone against an
// untrusted finished repo, and accept-check.js's header promises a planted file
// "can never satisfy this gate". That held for report JSON but not for the
// SCANNER'S OWN CONFIG: gitleaks auto-discovers <source>/.gitleaks.toml, and
// honors inline `gitleaks:allow` comments. Both live inside the audited tree,
// so the repo could switch off its own secret scan.
{
  const probe = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.log('skip  planted-gitleaks-config tests: gitleaks not installed');
  } else {
    const mkProj = (extra) => {
      const p = fs.mkdtempSync(path.join(tmpBase, 'hostile-repo-'));
      fs.mkdirSync(path.join(p, 'src'), { recursive: true });
      fs.writeFileSync(path.join(p, 'package.json'), '{"dependencies":{"express":"^4.0.0"}}\n');
      fs.writeFileSync(path.join(p, 'server.js'), 'module.exports = {};\n');
      fs.writeFileSync(path.join(p, 'src', 'config.js'),
        `const t = "${'ghp_' + '1234567890abcdefghij1234567890ABCDEF'}";${extra.inlineAllow ? ' //gitleaks:allow' : ''}\n`);
      if (extra.plantedConfig) fs.writeFileSync(path.join(p, '.gitleaks.toml'), '[allowlist]\npaths = [".*"]\n');
      if (extra.plantedIgnore) fs.writeFileSync(path.join(p, '.gitleaksignore'), 'src/config.js:github-pat:1\n');
      return p;
    };
    const statusFor = (p) => {
      const r = runNode(path.join(root, ...BACKEND.split('/')), ['--root', p, '--no-write']);
      try { return JSON.parse(r.stdout).checks.find((c) => c.id === 'B-client-secrets')?.status; }
      catch { return `unparseable: ${r.stdout.slice(0, 120)}`; }
    };
    expect('acceptance: baseline leak is caught', statusFor(mkProj({})) === 'fail');
    expect('acceptance: a planted .gitleaks.toml cannot disable the scan',
      statusFor(mkProj({ plantedConfig: true })) === 'fail');
    expect('acceptance: an inline gitleaks:allow comment cannot disable the scan',
      statusFor(mkProj({ inlineAllow: true })) === 'fail');
    expect('acceptance: a planted .gitleaksignore cannot disable the scan',
      statusFor(mkProj({ plantedIgnore: true })) === 'fail');
  }
}

// ---------- 11. CI must live where GitHub will actually read it ----------
// GitHub Actions only reads workflows from <repo root>/.github/workflows. This
// suite's workflow previously sat at v2/.github/workflows/ci.yml — a path
// Actions never looks at — so it had never run once, and every CI change made
// against it (Windows matrix, vale PATH handling, gitleaks install) was inert.
// Nothing in the suite could detect that, because running the tests locally
// works identically either way.
//
// Resolved against the real git root rather than an assumed layout, so this
// keeps holding after v2/ is promoted to the repo root.
{
  let repoRoot = root;
  while (!fs.existsSync(path.join(repoRoot, '.git'))) {
    const parent = path.dirname(repoRoot);
    if (parent === repoRoot) { repoRoot = null; break; }
    repoRoot = parent;
  }
  if (repoRoot === null) {
    console.log('skip  CI-location test: not inside a git checkout');
  } else {
    const wfDir = path.join(repoRoot, '.github', 'workflows');
    const workflows = fs.existsSync(wfDir)
      ? fs.readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f))
      : [];
    const runners = workflows.filter((f) => read(path.join(wfDir, f)).includes('run-tests.mjs'));
    expect('a workflow at the git root runs this suite\'s tests',
      runners.length > 0,
      `no workflow in ${path.relative(repoRoot, wfDir)} references run-tests.mjs (found: ${workflows.join(', ') || 'none'})`);

    // A workflow nested inside the suite directory is the exact dead-file
    // shape this test exists to prevent — flag it rather than let a future
    // edit quietly recreate it.
    const nestedWfDir = path.join(root, '.github', 'workflows');
    const nestedIsReal = path.resolve(nestedWfDir) === path.resolve(wfDir);
    expect('no dead workflow nested inside the suite directory',
      nestedIsReal || !fs.existsSync(nestedWfDir),
      `${nestedWfDir} exists but GitHub Actions will never read it`);
  }
}

// ---------- 12. Manifest parsers, against REAL-WORLD manifest shapes ----------
// The per-ecosystem readers were written against one hand-picked shape each and
// fixtured with that same shape, so the fixtures confirmed the implementation
// instead of probing it. Every case below is a normal, common way to write the
// manifest that returned ZERO dependencies — meaning serverPresent went false,
// B-scope short-circuited, and the entire backend gate silently skipped.
{
  const { classify } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'classify.cjs')));
  const mk = (files) => {
    const dir = fs.mkdtempSync(path.join(tmpBase, 'manifest-'));
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
    return dir;
  };
  // [label, files, expectServerPresent, mustContainDep, mustNotContainDep]
  const CASES = [
    ['py: single-line PEP-621 array',
      { 'pyproject.toml': '[project]\nname = "s"\ndependencies = ["flask", "sqlalchemy"]\n' }, true, 'flask'],
    ['py: PEP-621 state must not leak past the closing bracket',
      { 'pyproject.toml': '[project]\ndependencies = [\n  "requests",\n]\nclassifiers = [\n  "Framework :: Django :: 4.2",\n]\n' },
      false, null, 'django'],
    ['py: Poetry 1.2+ group syntax',
      { 'pyproject.toml': '[tool.poetry.group.main.dependencies]\nflask = "^3.0"\n' }, true, 'flask'],
    ['py: requirements.txt -r include is followed',
      { 'requirements.txt': '-r requirements/base.txt\n', 'requirements/base.txt': 'flask==3.0.0\n' }, true, 'flask'],
    ['go: second require block is parsed',
      { 'go.mod': 'module x\n\nrequire ( golang.org/x/text v0.3.0 )\n\nrequire ( github.com/labstack/echo/v4 v4.11.0 )\n' },
      true, 'github.com/labstack/echo/v4'],
    ['go: a paren inside a comment does not truncate the block',
      { 'go.mod': 'module x\n\nrequire (\n\t// gin (web framework)\n\tgithub.com/gin-gonic/gin v1.9.1\n)\n' },
      true, 'github.com/gin-gonic/gin'],
    ['go: // indirect deps are not counted as direct',
      { 'go.mod': 'module x\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n\tgorm.io/gorm v1.25.7 // indirect\n)\n' },
      true, 'github.com/gin-gonic/gin', 'gorm.io/gorm'],
    ['rust: [dependencies.foo] subtable',
      { 'Cargo.toml': '[package]\nname = "s"\n\n[dependencies]\nserde = "1.0"\n\n[dependencies.axum]\nversion = "0.7"\n' },
      true, 'axum'],
    ['rust: [workspace.dependencies]',
      { 'Cargo.toml': '[workspace]\nmembers = ["a"]\n\n[workspace.dependencies]\naxum = "0.7"\n' }, true, 'axum'],
    ['java: gradle coordinates without an inline version',
      { 'build.gradle': "dependencies {\n  implementation 'org.springframework.boot:spring-boot-starter-web'\n}\n" },
      true, 'spring-boot-starter-web'],
    ['java: pom <exclusion> is not counted as a dependency',
      { 'pom.xml': '<project><artifactId>my-svc</artifactId><dependencies><dependency>' +
        '<artifactId>spring-boot-starter-web</artifactId><exclusions><exclusion>' +
        '<artifactId>hibernate-core</artifactId></exclusion></exclusions></dependency></dependencies></project>\n' },
      true, 'spring-boot-starter-web', 'hibernate-core'],
    ['java: the project\'s own artifactId is not a dependency',
      { 'pom.xml': '<project><artifactId>my-svc</artifactId><dependencies><dependency>' +
        '<artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>\n' },
      true, 'spring-boot-starter-web', 'my-svc'],
    ['node: root server.ts counts as a server file',
      { 'package.json': '{}', 'server.ts': 'export {};\n' }, true, null],
  ];
  for (const [label, files, wantServer, mustHave, mustNotHave] of CASES) {
    const cls = classify(mk(files));
    const deps = cls.manifests.flatMap((m) => [...m.depNames]);
    expect(`classify — ${label}: serverPresent ${wantServer}`, cls.serverPresent === wantServer,
      `got ${cls.serverPresent}; deps: [${deps.join(', ')}]`);
    if (mustHave) {
      expect(`classify — ${label}: detects ${mustHave}`, deps.includes(mustHave), `deps: [${deps.join(', ')}]`);
    }
    if (mustNotHave) {
      expect(`classify — ${label}: does NOT count ${mustNotHave}`, !deps.includes(mustNotHave), `deps: [${deps.join(', ')}]`);
    }
  }
}

// ---------- 13. Mutation-killing checks ----------
// An external mutation audit ran 15 substantive mutations against this suite —
// thresholds moved, rule sets emptied, fail-closed policy inverted, drift
// detection disabled — and ALL 15 survived green. The fixtures pinned "a
// fixture exists for this line", not "this line is correct": every threshold
// was a free parameter over a huge range, because each fixture sat far from the
// boundary it was supposed to defend.
//
// Each block below is designed to DIE if the specific constant or branch it
// covers is changed. Where a threshold is involved, the values bracket it.
{
  const { hasHeading } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'report.cjs')));

  // hasHeading: the suite carried comments claiming to have killed v0.4's
  // "bare mention of the word satisfies the section" vacuity. It hadn't — the
  // block fixtures simply OMIT the word entirely, so they cannot distinguish a
  // prose mention from a real heading, and hasHeading could be reduced to a
  // substring match with every test still green.
  expect('hasHeading: a prose mention is NOT a heading',
    hasHeading('We take trust seriously and discuss Trust throughout.', 'Trust') === false);
  // These two are the ones that actually kill the vacuity mutant. A mid-sentence
  // mention is still rejected when the hash requirement is dropped but leading
  // whitespace is still required, so it does NOT discriminate on its own — the
  // word has to appear at the very start of a line, and indented, to force both
  // the `#{1,6}` and the `\s+` to be load-bearing.
  expect('hasHeading: a line STARTING with the word is not a heading',
    hasHeading('Trust is important to us.\n', 'Trust') === false);
  expect('hasHeading: an indented mention is not a heading',
    hasHeading('    Trust matters here.\n', 'Trust') === false);
  expect('hasHeading: a real heading is found', hasHeading('## Trust\n\nbody', 'Trust') === true);
  expect('hasHeading: requires a space after the hashes', hasHeading('##Trust', 'Trust') === false);
  expect('hasHeading: a longer word is not a match', hasHeading('## Trustworthy', 'Trust') === false);
  expect('hasHeading: regex metacharacters in the name are literal',
    hasHeading('## Totally unrelated heading', '.*') === false);

  // Contrast: bracket 4.5:1 tightly. The existing fixtures sit at 1.61 and
  // ~10.3, leaving the threshold free anywhere between.
  const { contrastRatio } = await import(pathToFileUrl(path.join(root, 'frontend', 'scripts', 'check-frontend.js')));
  const justBelow = contrastRatio('#777777', '#ffffff'); // 4.478
  const justAbove = contrastRatio('#767676', '#ffffff'); // 4.542
  expect('contrast: #777777 on white is just BELOW 4.5', justBelow < 4.5 && justBelow > 4.4, String(justBelow));
  expect('contrast: #767676 on white is just ABOVE 4.5', justAbove > 4.5 && justAbove < 4.6, String(justAbove));

  const tokenProj = (tokens) => {
    const p = fs.mkdtempSync(path.join(tmpBase, 'tokens-'));
    fs.mkdirSync(path.join(p, 'src'), { recursive: true });
    fs.writeFileSync(path.join(p, 'package.json'), '{"dependencies":{"react":"^18.0.0"}}\n');
    fs.writeFileSync(path.join(p, 'src', 'App.jsx'), 'export default () => null;\n');
    fs.writeFileSync(path.join(p, 'design-tokens.json'), JSON.stringify(tokens));
    return p;
  };
  const contrastStatus = (tokens) => {
    const r = runNode(path.join(root, ...FRONTEND.split('/')), ['--root', tokenProj(tokens), '--no-write']);
    try { return JSON.parse(r.stdout).checks.find((c) => c.id === 'F-tokens-contrast')?.status; }
    catch { return 'unparseable'; }
  };
  expect('contrast: 4.48:1 fails (just under the WCAG AA threshold)',
    contrastStatus({ 'text-main': '#777777', 'surface-base': '#ffffff' }) === 'fail');
  expect('contrast: 4.60:1 passes (just over the WCAG AA threshold)',
    contrastStatus({ 'text-main': '#767676', 'surface-base': '#ffffff' }) === 'pass');

  // Nesting depth and file size: bracket both thresholds exactly.
  const SMELLS = path.join(root, 'code-smells', 'scripts', 'check-smells.js');
  const smellsStatus = (id, files) => {
    const p = fs.mkdtempSync(path.join(tmpBase, 'smells-'));
    for (const [rel, content] of Object.entries(files)) fs.writeFileSync(path.join(p, rel), content);
    const r = runNode(SMELLS, ['--root', p]);
    try { return JSON.parse(r.stdout).checks.find((c) => c.id === id)?.status; } catch { return 'unparseable'; }
  };
  const nested = (depth) => {
    let s = '';
    for (let i = 0; i < depth; i++) s += `${'  '.repeat(i)}if (x${i}) {\n`;
    for (let i = depth - 1; i >= 0; i--) s += `${'  '.repeat(i)}}\n`;
    return s;
  };
  expect('nesting: depth 5 passes (at the limit)', smellsStatus('S-deep-nesting', { 'a.js': nested(5) }) === 'pass');
  expect('nesting: depth 6 fails (one over)', smellsStatus('S-deep-nesting', { 'a.js': nested(6) }) === 'fail');
  expect('file size: 400 lines passes (at the limit)',
    smellsStatus('S-large-file', { 'a.js': 'const a = 1;\n'.repeat(400) }) === 'pass');
  expect('file size: 401 lines fails (one over)',
    smellsStatus('S-large-file', { 'a.js': 'const a = 1;\n'.repeat(401) }) === 'fail');

  // isServerOnlyPath: every existing secret fixture puts the secret in a
  // client path, so the deny-list could be replaced with `return false` and
  // stay green. A secret under server/ must NOT be reported.
  const gl = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  if (gl.error || gl.status !== 0) {
    console.log('skip  isServerOnlyPath discrimination test: gitleaks not installed');
  } else {
    const secretIn = (rel) => {
      const p = fs.mkdtempSync(path.join(tmpBase, 'serveronly-'));
      fs.mkdirSync(path.join(p, path.dirname(rel)), { recursive: true });
      fs.writeFileSync(path.join(p, 'package.json'), '{"dependencies":{"express":"^4.0.0"}}\n');
      fs.writeFileSync(path.join(p, 'server.js'), 'module.exports = {};\n');
      fs.writeFileSync(path.join(p, rel), `const t = "${'ghp_' + '1234567890abcdefghij1234567890ABCDEF'}";\n`);
      const r = runNode(path.join(root, ...BACKEND.split('/')), ['--root', p, '--no-write']);
      try { return JSON.parse(r.stdout).checks.find((c) => c.id === 'B-client-secrets')?.status; }
      catch { return 'unparseable'; }
    };
    expect('server-only: a secret in src/ IS reported', secretIn('src/config.js') === 'fail');
    expect('server-only: a secret under server/ is NOT reported', secretIn('server/config.js') === 'pass');
  }
}

// ---------- 13b. gen-contract drift detection must be able to fail ----------
// --check was only ever asserted in the passing direction, so its exit(1)
// branch could be deleted and CI would still be green while the contract
// silently drifted from registry.json.
{
  const copy = fs.mkdtempSync(path.join(tmpBase, 'drift-'));
  fs.cpSync(path.join(root, 'core'), path.join(copy, 'core'), { recursive: true });
  fs.cpSync(path.join(root, 'scripts'), path.join(copy, 'scripts'), { recursive: true });
  fs.cpSync(path.join(root, 'docs'), path.join(copy, 'docs'), { recursive: true });
  const reg = JSON.parse(read(path.join(root, 'registry.json')));
  reg.skills.push({ id: 'a-skill-not-in-the-contract', role: 'deliberate drift' });
  fs.writeFileSync(path.join(copy, 'registry.json'), JSON.stringify(reg, null, 2));
  const r = runNode(path.join(copy, 'scripts', 'gen-contract.mjs'), ['--check']);
  expect('gen-contract --check FAILS when the contract drifts from registry.json',
    r.status !== 0, `exit ${r.status}`);
}

// ---------- 13c. The installer must refuse to clobber what it didn't create ----------
// The marker-ownership guard could be replaced with `if (false)` — deleting any
// directory in its path — and no test noticed.
{
  const dest = fs.mkdtempSync(path.join(tmpBase, 'clobber-'));
  const victim = path.join(dest, 'mental-models');
  fs.mkdirSync(victim, { recursive: true });
  fs.writeFileSync(path.join(victim, 'PRECIOUS.txt'), 'not installer-created\n');
  const r = spawnSync(process.execPath,
    [path.join(root, 'scripts', 'install.mjs'), '--dest', dest, '--skill', 'mental-models'],
    { cwd: root, encoding: 'utf8' });
  expect('installer: refuses a directory it did not create', r.status !== 0, `exit ${r.status}`);
  expect('installer: leaves the pre-existing file intact', fs.existsSync(path.join(victim, 'PRECIOUS.txt')));
  const forced = spawnSync(process.execPath,
    [path.join(root, 'scripts', 'install.mjs'), '--dest', dest, '--skill', 'mental-models', '--force'],
    { cwd: root, encoding: 'utf8' });
  expect('installer: --force does replace it', forced.status === 0 && fs.existsSync(path.join(victim, 'SKILL.md')),
    forced.stderr || forced.stdout);
}

// ---------- 14. Import-edge extraction must cover real-world import shapes ----------
// Every cycle fixture used CommonJS `require()` on a single line, so the ESM
// path — the majority case in any modern codebase — contributed zero coverage
// and could be deleted entirely with the suite still green. Worse, the clause
// matcher was `[^\n]*?`, which cannot cross a newline: Prettier splits any
// import list past ~80 chars, so in a normally-formatted TS project MOST import
// edges were invisible and cycles through them reported "no circular imports".
{
  const { localImportsOf } = await import(pathToFileUrl(path.join(root, 'code-organization', 'scripts', 'check-organization.js')));
  const CASES = [
    ['single-line ESM', "import a from './a';", ['./a']],
    ['multi-line ESM (Prettier default output)', "import {\n  alpha,\n  beta,\n} from './a';", ['./a']],
    ['side-effect import', "import './a';", ['./a']],
    ['named re-export (barrel file)', "export { x } from './a';", ['./a']],
    ['star re-export (barrel file)', "export * from './a';", ['./a']],
    ['two imports on one line', "import a from './a'; import b from './b';", ['./a', './b']],
    ['dynamic import', "const m = await import('./a');", ['./a']],
    ['commonjs require', "const a = require('./a');", ['./a']],
    ['package imports are ignored', "import React from 'react';", []],
    ['type-only import creates no runtime edge', "import type { X } from './a';", []],
    ['type-only re-export creates no runtime edge', "export type { X } from './a';", []],
  ];
  for (const [label, src, want] of CASES) {
    const got = localImportsOf(src);
    expect(`imports — ${label}`, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}`);
  }

  // End-to-end: a genuine cycle expressed in ESM across multi-line imports and
  // a barrel re-export must BLOCK, not report "no circular imports".
  const ORG = path.join(root, 'code-organization', 'scripts', 'check-organization.js');
  const esmCycle = fs.mkdtempSync(path.join(tmpBase, 'esm-cycle-'));
  fs.mkdirSync(path.join(esmCycle, 'src'), { recursive: true });
  fs.writeFileSync(path.join(esmCycle, 'src', 'a.ts'),
    "import {\n  bThing,\n  bOther,\n} from './b';\n\nexport const aThing = () => bThing() + bOther();\n");
  fs.writeFileSync(path.join(esmCycle, 'src', 'b.ts'),
    "export { aThing } from './a';\n\nexport const bThing = () => 1;\nexport const bOther = () => 2;\n");
  const r = runNode(ORG, ['--root', esmCycle]);
  let rep = null;
  try { rep = JSON.parse(r.stdout); } catch { /* asserted below */ }
  expect('imports — a multi-line ESM + barrel-re-export cycle is detected',
    rep && rep.verdict === 'BLOCK', JSON.stringify(rep && rep.checks));
}

fs.rmSync(tmpBase, { recursive: true, force: true });
console.log(failures === 0 ? '\nAll tests passed.' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
