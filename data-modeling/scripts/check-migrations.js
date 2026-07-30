#!/usr/bin/env node
'use strict';
// Checks raw .sql migration files for destructive/unsafe patterns. This is
// NOT "the data-modeling checker" — it's one narrow, genuinely-checkable
// slice of that skill's much broader judgment scope (keys, normalization,
// nullability, relational-vs-document choice), and every check id below is
// prefixed DM-sql- specifically so a report can never be misread as having
// evaluated data modeling generally. A project modeling its data as
// NoSQL documents, an ORM's own schema DSL (Prisma schema, Django models,
// SQLAlchemy models), GraphQL, or protobuf gets NONE of this checked
// mechanically — that's not an oversight, it's the actual boundary of what
// text-matching on raw SQL can verify. SKILL.md's rules apply to all of
// those regardless; only this narrow slice has a script behind it.
//
// Checks (sourced from real migration linters — Squawk, strong_migrations
// — not invented): destructive drops, an added/altered NOT NULL column
// with no safe path, a rename (breaks old code mid-deploy), and a volatile
// function as a column default (forces a full table rewrite even though a
// static default is metadata-only on modern Postgres).
//
// Down/rollback migrations are expected to contain drops and reversals by
// design and are excluded: recognized by filename
// (*.down.sql, *_down.sql, *.rollback.sql, a down/ or revert/ directory)
// or by an inline marker (`-- +goose Down`, `-- migrate:down`), after
// which the rest of the file is not scanned.
//
// Usage: node check-migrations.js --root <dir> [--strict] [--report <path>]
// Exit codes: 0 clean (or findings without --strict), 1 findings (or
// --strict with any), 3 internal error.

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.agent-evidence']);
const DOWN_FILENAME_RE = /(\.down\.sql|_down\.sql|\.rollback\.sql)$/i;
const DOWN_DIR_RE = /(^|[/\\])(down|revert|rollback)([/\\]|$)/i;
const DOWN_MARKER_RE = /^\s*--\s*\+goose\s+Down\b|^\s*--\s*migrate:down\b/im;
const MAX_FILES = 20000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const VOLATILE_DEFAULT_FUNCS = '(gen_random_uuid|uuid_generate\\w*|now|clock_timestamp|random|nextval)';

function parseArgs(argv) {
  const out = { root: '.', strict: false, reportPath: null, files: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') out.root = argv[++i];
    else if (a === '--strict') out.strict = true;
    else if (a === '--report' || a === '--out') out.reportPath = argv[++i];
    else if (a === '--files') {
      const v = argv[++i];
      if (v) out.files = (out.files || []).concat(v.split(',').map((s) => s.trim()).filter(Boolean));
      else out.files = out.files || [];
    }
  }
  return out;
}

// --files restricts the scan to specific paths (relative to --root, or
// absolute) instead of walking the whole tree, so this checker can run as a
// pre-commit hook without a whole-repo scan blocking the first commit on any
// project whose migration history isn't already clean.
//
// Every check here is a property of one file read in isolation (a DROP, a
// RENAME, an ADD COLUMN ... NOT NULL), so restricting the scan set IS the
// whole implementation — the same case as check-smells.js, and unlike
// check-organization.js, where a cycle spans files the commit may not touch
// and only the REPORTING can be scoped.
//
// Named paths that don't exist (a staged deletion) or aren't .sql are dropped
// rather than erroring: the caller passes a commit's file list, not a curated
// one, and "that path is not a migration" is not a failure.
function resolveScope(root, names) {
  const out = [];
  for (const name of names) {
    const full = path.isAbsolute(name) ? name : path.join(root, name);
    if (path.extname(full).toLowerCase() !== '.sql') continue;
    try {
      if (!fs.statSync(full).isFile()) continue;
    } catch { continue; }
    out.push(full);
  }
  return out;
}

function walk(dir, out, truncated) {
  if (out.length >= MAX_FILES) { truncated.hit = true; return; }
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (out.length >= MAX_FILES) { truncated.hit = true; return; }
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out, truncated);
    else if (path.extname(e.name).toLowerCase() === '.sql') out.push(full);
  }
}

// Blanks -- line comments, /* */ block comments, and '...'/"..." string and
// identifier content (replacing with spaces, preserving newlines) so the
// statement checks below can't be thrown off by a keyword appearing inside
// one. Handles BOTH standard SQL's doubled-quote escape ('') and MySQL's
// non-standard backslash escape (\') — MySQL accepts backslash escapes by
// default (NO_BACKSLASH_ESCAPES is not its factory default), so a stripper
// that only knew '' would mis-terminate a MySQL migration's string early.
function stripSqlStringsAndComments(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '-' && next === '-') {
      while (i < n && text[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '/' && next === '*') {
      out += '  '; i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) {
        out += text[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) { out += '  '; i += 2; }
      continue;
    }
    if (c === "'" || c === '"') {
      const scanned = blankQuoted(text, i);
      out += scanned.out;
      i = scanned.next;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Blanks one '...' or "..." run starting at the opening quote, returning the
// blanked text and the index just past the closing quote. Extracted from
// stripSqlStringsAndComments' main loop, where it sat at brace depth 6 and
// this suite's own S-deep-nesting check flagged it — the quote-scanning
// state machine is a separate concern from the outer dispatch anyway, so
// naming it costs nothing and the nesting problem goes with it.
function blankQuoted(text, start) {
  const n = text.length;
  const quote = text[start];
  let out = ' ';
  let i = start + 1;
  while (i < n) {
    // MySQL backslash escape: consume both chars so \' can't end the string.
    if (text[i] === '\\' && i + 1 < n) {
      out += text[i] === '\n' ? '\n' : ' ';
      out += text[i + 1] === '\n' ? '\n' : ' ';
      i += 2;
      continue;
    }
    // Standard SQL doubled-quote escape ('') — not a terminator.
    if (text[i] === quote && text[i + 1] === quote) {
      out += '  ';
      i += 2;
      continue;
    }
    if (text[i] === quote) break;
    out += text[i] === '\n' ? '\n' : ' ';
    i++;
  }
  if (i < n) { out += ' '; i++; } // closing quote
  return { out, next: i };
}

function isDownMigrationFile(relPath) {
  return DOWN_FILENAME_RE.test(relPath) || DOWN_DIR_RE.test(relPath);
}

// Truncates at an inline `-- +goose Down` / `-- migrate:down` marker (found
// on the UNCLEANED text, since these are themselves comment lines) so only
// the up-migration portion of a single mixed up/down file gets scanned.
function upPortionOnly(text) {
  const m = text.match(DOWN_MARKER_RE);
  return m ? text.slice(0, m.index) : text;
}

function splitStatements(cleanedText) {
  return cleanedText.split(';').map((s) => s.trim()).filter(Boolean);
}

function check(id, status, detail) {
  return { id, status, detail };
}

function makeReport(checks) {
  const verdict = checks.some((c) => c.status === 'fail') ? 'BLOCK'
    : checks.some((c) => c.status === 'not_evaluated') ? 'CONDITIONAL'
    : 'SHIP';
  return {
    schemaVersion: 1,
    skill: 'data-modeling',
    generatedAt: new Date().toISOString(),
    root: process.cwd(),
    verdict,
    checks,
  };
}

// See the matching guard in code-organization/scripts/check-organization.js:
// walk() deliberately swallows readdirSync errors, which on the ROOT turned a
// typo'd --root into a clean SHIP. Scanned-and-empty may pass; unscannable may not.
function assertReadableRoot(root) {
  let stat;
  try {
    stat = fs.statSync(root);
  } catch (e) {
    throw new Error(`--root is not readable: ${root} (${e.code || e.message})`);
  }
  if (!stat.isDirectory()) throw new Error(`--root is not a directory: ${root}`);
}

function run(root, opts = {}) {
  assertReadableRoot(root);
  const files = [];
  const truncated = { hit: false };
  if (opts.files) files.push(...resolveScope(root, opts.files));
  else walk(root, files, truncated);

  const scanned = files.filter((f) => !isDownMigrationFile(path.relative(root, f).split(path.sep).join('/')));

  if (scanned.length === 0) {
    return [check('DM-sql-scope', 'pass', 'no (up-)migration .sql files found; SQL migration-safety checks not applicable')];
  }

  const drops = [];
  const unsafeNotNull = [];
  const renames = [];
  const volatileDefaults = [];
  let skippedForSize = 0;

  for (const file of scanned) {
    let raw;
    try {
      const stat = fs.statSync(file);
      if (stat.size > MAX_FILE_BYTES) { skippedForSize++; continue; }
      raw = fs.readFileSync(file, 'utf8');
    } catch { continue; }

    const rel = path.relative(root, file).split(path.sep).join('/');
    const cleanedFull = stripSqlStringsAndComments(upPortionOnly(raw));
    const statements = splitStatements(cleanedFull);

    for (const stmt of statements) {
      if (/\bDROP\s+(TABLE|COLUMN)\b/i.test(stmt)) drops.push(rel);
      if (/\bRENAME\s+(COLUMN|TO)\b/i.test(stmt)) renames.push(rel);
      if (/\bADD\s+COLUMN\b/i.test(stmt) && /\bNOT\s+NULL\b/i.test(stmt) && !/\bDEFAULT\b/i.test(stmt)) {
        unsafeNotNull.push(`${rel} (ADD COLUMN ... NOT NULL with no DEFAULT)`);
      }
      if (/\bALTER\s+COLUMN\s+\S+\s+SET\s+NOT\s+NULL\b/i.test(stmt)) {
        unsafeNotNull.push(`${rel} (SET NOT NULL requires a full-table scan)`);
      }
      if (/\bADD\s+COLUMN\b/i.test(stmt) && new RegExp(`\\bDEFAULT\\s+${VOLATILE_DEFAULT_FUNCS}\\s*\\(`, 'i').test(stmt)) {
        volatileDefaults.push(rel);
      }
    }
  }

  const uniq = (arr) => [...new Set(arr)];
  const checks = [];
  checks.push(drops.length > 0
    ? check('DM-sql-destructive-drop', 'fail', `DROP TABLE/COLUMN in: ${uniq(drops).join(', ')}`)
    : check('DM-sql-destructive-drop', 'pass', 'no DROP TABLE/COLUMN in scanned migrations'));
  checks.push(unsafeNotNull.length > 0
    ? check('DM-sql-unsafe-not-null', 'fail', uniq(unsafeNotNull).join('; '))
    : check('DM-sql-unsafe-not-null', 'pass', 'no unsafe NOT NULL addition found'));
  checks.push(renames.length > 0
    ? check('DM-sql-rename', 'fail', `RENAME COLUMN/TABLE in: ${uniq(renames).join(', ')} — old code reading the old name breaks mid-deploy`)
    : check('DM-sql-rename', 'pass', 'no RENAME COLUMN/TABLE in scanned migrations'));
  checks.push(volatileDefaults.length > 0
    ? check('DM-sql-volatile-default', 'fail', `ADD COLUMN with a volatile function default (forces a full table rewrite) in: ${uniq(volatileDefaults).join(', ')}`)
    : check('DM-sql-volatile-default', 'pass', 'no volatile-function column default added'));

  const notes = [];
  if (skippedForSize > 0) notes.push(`${skippedForSize} file(s) skipped (over size cap)`);
  if (truncated.hit) notes.push('file walk hit the safety cap; scan may not cover the whole tree');
  if (notes.length > 0) checks.push(check('DM-sql-scan-completeness', 'not_evaluated', notes.join('; ')));

  return checks;
}

function finish(checks, args, exitCode) {
  const report = makeReport(checks);
  const json = JSON.stringify(report, null, 2);
  if (args.reportPath) fs.writeFileSync(args.reportPath, json + '\n');
  console.log(json);
  process.exit(exitCode);
}

module.exports = { run, stripSqlStringsAndComments, isDownMigrationFile, upPortionOnly };

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  try {
    const checks = run(args.root, { files: args.files });
    const hasFail = checks.some((c) => c.status === 'fail');
    const exitCode = hasFail ? 1 : args.strict && checks.some((c) => c.status !== 'pass') ? 1 : 0;
    finish(checks, args, exitCode);
  } catch (e) {
    finish([check('DM-sql-internal-error', 'fail', e.message)], args, 3);
  }
}
