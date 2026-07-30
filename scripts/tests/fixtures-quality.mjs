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
