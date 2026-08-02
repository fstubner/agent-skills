import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  root, registry, read, expect, runNode, walk, pathToFileUrl,
  tmpBase, runFixture, assertFixture, ARCH, BACKEND, FRONTEND, ACCEPT,
} from './harness.mjs';


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
// backend-block-secret injects its secret at test time rather than committing
// one — see the note in that fixture's public/app.js. This is NOT a test of
// gitleaks' detection (third-party, assumed working); it pins OUR integration:
// that check-backend invokes it at all, scans CLIENT-SERVED paths (a Next.js
// blind spot and a src/ false positive were both real bugs here), maps the
// result to B-client-secrets/BLOCK, and reports the path while never writing
// the value into a report that lands on disk.
{
  const CLIENT_SECRET = 'sk_' + 'live_' + 'ABCDEF1234567890abcd';
  const src = path.join(root, 'fixtures', 'backend-block-secret');
  const dest = path.join(tmpBase, 'backend-block-secret-' + Math.random().toString(36).slice(2, 8));
  fs.cpSync(src, dest, { recursive: true });
  const clientFile = path.join(dest, 'public', 'app.js');
  const runBackend = () => {
    const r = runNode(path.join(root, ...BACKEND.split('/')), ['--root', dest, '--no-write']);
    let report = null;
    try { report = JSON.parse(r.stdout); } catch { /* asserted by caller */ }
    return { r, report };
  };

  // Control: without the injected key the fixture must SHIP. The committed
  // version could not assert this, so nothing pinned B-client-secrets as the
  // reason for the block — any other fixture defect would have looked the same.
  const before = runBackend();
  expect('backend-block-secret: fixture PASSES before the secret is injected (control)',
    Boolean(before.report) && before.report.verdict === 'SHIP',
    before.report ? JSON.stringify(before.report.checks) : (before.r.stderr || '').slice(0, 200));

  fs.appendFileSync(clientFile, `\nconst key = "${CLIENT_SECRET}";\n`);
  const after = runBackend();
  expect('backend-block-secret: emits parseable report', after.report !== null,
    (after.r.stderr || '').slice(0, 200));
  if (after.report) {
    expect('backend-block-secret: verdict BLOCK', after.report.verdict === 'BLOCK',
      JSON.stringify(after.report.checks));
    const c = after.report.checks.find((x) => x.id === 'B-client-secrets');
    expect('backend-block-secret: check B-client-secrets is fail',
      Boolean(c) && c.status === 'fail', c ? `${c.status} (${c.detail})` : 'check missing');
    expect('backend-block-secret: reports path, never the value',
      Boolean(c) && c.detail.includes('public/app.js') && !c.detail.includes(CLIENT_SECRET),
      c && c.detail);
  }
  expect('backend-block-secret: exit code 1', after.r.status === 1, `got ${after.r.status}`);
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

// A design-direction.md that exists but records no interview must FAIL.
// The measured failure of `frontend` is not interviewing badly, it's not
// interviewing at all and filling the file from invented taste — which a
// mere existence check cannot distinguish from a real one. Without this
// test, dropping requiredHeadings from the registry entry would silently
// restore that hole and every fixture would still pass.
{
  const src = path.join(root, 'fixtures', 'accept-ship');
  const dest = path.join(tmpBase, 'accept-no-interview-' + Math.random().toString(36).slice(2, 8));
  fs.cpSync(src, dest, { recursive: true });
  const dd = path.join(dest, 'design-direction.md');
  fs.writeFileSync(dd, read(dd).replace(/## Interview[\s\S]*?(?=## Mood)/, ''));

  const r = runNode(path.join(root, ...ACCEPT.split('/')), ['--root', dest, '--strict']);
  let report = null;
  try { report = JSON.parse(r.stdout); } catch { /* asserted below */ }
  expect('design-direction without an Interview section: emits parseable report',
    report !== null, (r.stderr || '').slice(0, 200));
  if (report) {
    const c = report.checks.find((x) => x.id === 'A-design-direction');
    expect('design-direction without an Interview section fails A-design-direction',
      Boolean(c) && c.status === 'fail', c ? `${c.status} (${c.detail})` : 'check missing');
    expect('design-direction without an Interview section names the missing heading',
      Boolean(c) && /interview/i.test(c.detail || ''), c && c.detail);
  }
}

// ---------- 4f. Vacuous-section and minified-file false passes ----------
// Found by adversarial probe, 2026-08-02. Both were SHIPs that should have
// been BLOCKs — the worst class of defect this suite can have, since a gate
// that passes the document it exists to reject is worse than no gate.
//
// The section one is a repeat of v0.4's vacuous gate one level down: that fix
// stopped a bare mention in PROSE satisfying a heading requirement, but a
// heading with NOTHING UNDER IT still passed. An agent that knows the gate
// checks headings produces exactly that document.
assertFixture('arch-block-empty-sections (headings present, all bodies empty)',
  'arch-block-empty-sections', ARCH, [], 'BLOCK',
  [['P-section-parts', 'fail'], ['P-section-boundaries', 'fail'], ['P-section-trust', 'fail']]);

// A copied-but-unfilled template must not pass on the strength of its own
// guidance comments — assets/ templates are all written with HTML comments.
assertFixture('arch-block-template-comments (bodies contain only template comments)',
  'arch-block-template-comments', ARCH, [], 'BLOCK',
  [['P-section-parts', 'fail'], ['P-section-boundaries', 'fail'], ['P-section-trust', 'fail']]);

// Minified/generated code defeats a line-count size check: 160KB on one line
// reads as a 1-line file. Longest-line is the discriminator.
{
  const SMELLS = path.join(root, 'code-smells', 'scripts', 'check-smells.js');
  const r = runNode(SMELLS, ['--root', path.join(root, 'fixtures', 'code-smells-minified'), '--no-write']);
  let report = null;
  try { report = JSON.parse(r.stdout); } catch { /* asserted below */ }
  expect('code-smells minified: emits parseable report', report !== null, (r.stderr || '').slice(0, 200));
  if (report) {
    expect('code-smells: a single-line minified bundle BLOCKs (line count alone misses it)',
      report.verdict === 'BLOCK', JSON.stringify(report.checks));
    const c = report.checks.find((x) => x.id === 'S-large-file');
    expect('code-smells: S-large-file names the long line, not a line count',
      Boolean(c) && c.status === 'fail' && /char line/.test(c.detail || ''),
      c ? c.detail : 'check missing');
  }
}
