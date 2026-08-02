import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  root, registry, read, expect, runNode, walk, pathToFileUrl,
  tmpBase, runFixture, assertFixture, ARCH, BACKEND, FRONTEND, ACCEPT,
} from './harness.mjs';

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

// ---------- 4e. data-modeling: SET NOT NULL, safe vs bare ----------
// A forced-exposure eval (2026-08-02) caught this checker contradicting
// data-modeling/SKILL.md: the skill prescribes add-nullable -> backfill ->
// make-required, and the checker failed the final step unconditionally, so
// following the skill produced SQL the skill's own checker blocked.
//
// Resolution: bare SET NOT NULL IS dangerous (ACCESS EXCLUSIVE + full scan),
// so the check stays — but a CHECK ... NOT VALID that has been VALIDATEd
// makes PG12+ skip the scan, and that sequence now passes. The preamble sits
// in EARLIER migration files on purpose, because splitting it is the whole
// point: one long transaction is what you are avoiding. That is why the
// checker collects validated constraints across all files before judging any.
{
  const MIG = path.join(root, 'data-modeling', 'scripts', 'check-migrations.js');
  const runFx = (fx) => {
    const r = runNode(MIG, ['--root', path.join(root, 'fixtures', fx), '--no-write']);
    let report = null;
    try { report = JSON.parse(r.stdout); } catch { /* asserted below */ }
    return { r, report };
  };

  const safe = runFx('data-modeling-safe-not-null');
  expect('data-modeling safe NOT NULL: emits parseable report', safe.report !== null,
    (safe.r.stderr || '').slice(0, 200));
  if (safe.report) {
    expect('data-modeling: CHECK NOT VALID -> VALIDATE -> SET NOT NULL is SHIP',
      safe.report.verdict === 'SHIP', JSON.stringify(safe.report.checks));
    const c = safe.report.checks.find((x) => x.id === 'DM-sql-unsafe-not-null');
    expect('data-modeling: DM-sql-unsafe-not-null passes for the validated sequence',
      Boolean(c) && c.status === 'pass', c ? `${c.status} (${c.detail})` : 'check missing');
  }

  const bare = runFx('data-modeling-bare-not-null');
  expect('data-modeling bare NOT NULL: emits parseable report', bare.report !== null,
    (bare.r.stderr || '').slice(0, 200));
  if (bare.report) {
    expect('data-modeling: bare SET NOT NULL (no validated constraint) still BLOCKs',
      bare.report.verdict === 'BLOCK', JSON.stringify(bare.report.checks));
    const c = bare.report.checks.find((x) => x.id === 'DM-sql-unsafe-not-null');
    expect('data-modeling: DM-sql-unsafe-not-null fails for a bare SET NOT NULL',
      Boolean(c) && c.status === 'fail', c ? `${c.status} (${c.detail})` : 'check missing');
  }
}

// ---------- 4g. code-smells: shotgun surgery from git history ----------
// The one smell in the catalog that cannot be seen in a file. code-smells'
// own trigger names it — "a change touches the same handful of files every
// time" — but the skill had no way to FIND it until this checker existed:
// the catalog defined the pattern and gave a fix, and nothing detected it.
// That gap is also why an eval limited to single-file smells concluded the
// skill added nothing (see eval/results/CORRECTION-2026-08-02-*).
//
// Real git repos are built here rather than mocking `git log`, because the
// parsing of its output is half of what can break.
{
  const CHECKER = path.join(root, 'code-smells', 'scripts', 'check-cochange.js');
  const mkRepo = (name) => {
    const d = fs.mkdtempSync(path.join(tmpBase, name + '-'));
    const git = (...a) => spawnSync('git', ['-C', d, ...a], { encoding: 'utf8' });
    git('init', '-q');
    git('config', 'user.email', 't@e.com');
    git('config', 'user.name', 'T');
    return { d, git };
  };
  const touch = (d, rel, s) => {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, s);
  };
  const verdictOf = (d) => {
    const r = runNode(CHECKER, ['--root', d, '--no-write']);
    try { return JSON.parse(r.stdout).checks[0]; } catch { return { status: 'ERR', detail: (r.stderr || '').slice(0, 160) }; }
  };

  // A. Adding a field forces edits in four layers, every time. The smell.
  {
    const { d, git } = mkRepo('sg-dirty');
    const layers = ['api/routes.js', 'db/schema.js', 'ui/form.js', 'validation/rules.js'];
    for (const f of layers) touch(d, f, '// init\n');
    git('add', '-A'); git('commit', '-qm', 'init');
    for (let i = 0; i < 24; i++) {
      for (const f of layers) touch(d, f, `// field ${i}\n`);
      git('add', '-A'); git('commit', '-qm', `field ${i}`);
    }
    const c = verdictOf(d);
    expect('code-smells: shotgun surgery across 4 layers is detected', c.status === 'fail', `${c.status}: ${c.detail}`);
    expect('code-smells: the finding names the co-changing files',
      c.status === 'fail' && /api\/routes\.js/.test(c.detail) && /db\/schema\.js/.test(c.detail), c.detail);
  }

  // B. Same volume of history, but each change stays inside one module.
  // Cohesion must NOT be reported — this is what good structure looks like,
  // and flagging it would make the check unusable on a healthy codebase.
  {
    const { d, git } = mkRepo('sg-clean');
    const mods = { orders: ['orders/index.js', 'orders/model.js', 'orders/api.js'],
                   billing: ['billing/index.js', 'billing/model.js', 'billing/api.js'] };
    for (const fs_ of Object.values(mods)) for (const f of fs_) touch(d, f, '// init\n');
    git('add', '-A'); git('commit', '-qm', 'init');
    for (const [name, files] of Object.entries(mods)) {
      for (let i = 0; i < 15; i++) {
        for (const f of files) touch(d, f, `// ${name} ${i}\n`);
        git('add', '-A'); git('commit', '-qm', `${name} ${i}`);
      }
    }
    const c = verdictOf(d);
    expect('code-smells: cohesive single-module changes are NOT flagged', c.status === 'pass', `${c.status}: ${c.detail}`);
  }

  // C. Too little history must be not_evaluated, never a confident pass —
  // the suite's standing rule that absent evidence never reads as success.
  {
    const { d, git } = mkRepo('sg-thin');
    touch(d, 'a.js', 'x'); touch(d, 'b.js', 'x');
    git('add', '-A'); git('commit', '-qm', 'one');
    const c = verdictOf(d);
    expect('code-smells: thin history is not_evaluated, not a pass', c.status === 'not_evaluated', `${c.status}: ${c.detail}`);
  }

  // D. Not a git repo at all: same rule.
  {
    const d = fs.mkdtempSync(path.join(tmpBase, 'sg-nogit-'));
    fs.writeFileSync(path.join(d, 'a.js'), 'x');
    const c = verdictOf(d);
    expect('code-smells: a non-git directory is not_evaluated', c.status === 'not_evaluated', `${c.status}: ${c.detail}`);
  }
}
