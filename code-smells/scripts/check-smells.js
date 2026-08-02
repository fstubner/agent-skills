#!/usr/bin/env node
'use strict';
// Two of code-smells/SKILL.md's rules that are genuinely low-risk to check
// deterministically: file size and nesting depth. Everything else in that
// catalog (long function, feature envy, primitive obsession, ...) needs
// real understanding of what code MEANS, not just its shape — see
// SKILL.md's "no checker script" rationale, which this file's narrow scope
// doesn't contradict.
//
// Deliberately NOT attempted: function-boundary detection (too many syntax
// forms across languages — declarations, expressions, arrow functions,
// method shorthand, class methods — to identify reliably without a real
// per-language parser, and a wrong function boundary is worse than no
// function-length check at all) and long-parameter-list (same problem:
// needs a reliable function signature boundary). Deep nesting is checked
// WITHOUT attributing depth to a specific function for the same reason —
// it reports the single deepest point in the file, which needs no
// function-boundary detection.
//
// Language scope is DELIBERATELY split in two, not "every language" or
// "JS only" — a codebase reviewed with this skill is not assumed to be
// JavaScript/TypeScript just because that's this suite's other checkers'
// common case (frontend/backend-engineering read package.json, which is
// its own separate, narrower assumption — not one this checker repeats):
// - File size (S-large-file) needs no language-specific parsing at all —
//   a long file is a long file in any language — so it scans broadly
//   across common source extensions.
// - Nesting depth (S-deep-nesting) needs brace-aware, comment/string-aware
//   scanning (see stripStringsAndComments below), which only generalizes
//   correctly to brace-delimited languages with backslash-escaped string
//   literals — JS/TS and the C-family. Indentation-based languages
//   (Python, Ruby, YAML) have no brace signal to read and are out of
//   scope here, not silently mishandled — see BRACE_LANGUAGE_EXTENSIONS.
//   Go is deliberately excluded even though it uses braces: its backtick
//   raw strings don't process backslash escapes the way this function
//   assumes for every backtick-delimited string, which would occasionally
//   misparse a raw string containing a literal backslash.
//
// Usage: node check-smells.js --root <dir> [--strict] [--report <path>]
// Exit codes: 0 clean (or findings without --strict), 1 findings (or
// --strict with any), 3 internal error.

const fs = require('fs');
const path = require('path');

const ALL_SOURCE_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte',
  '.py', '.rb', '.go', '.java', '.kt', '.scala',
  '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.php', '.rs', '.swift', '.m', '.mm',
];
const BRACE_LANGUAGE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.java', '.kt', '.scala', '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.php', '.swift',
]);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo', 'vendor', '.venv', '__pycache__', '.agent-evidence']);
const MAX_FILES = 20000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const LARGE_FILE_LINES = 400;
const DEEP_NESTING_DEPTH = 5;
// Longest line that still reads as human-authored source. Minified bundles run
// to tens of thousands of characters on one line; hand-written code with a
// 1000-char line is already the problem this check reports.
const MINIFIED_LINE_CHARS = 1000;

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
// absolute) instead of walking the whole tree. This exists so the checker can
// run as a pre-commit hook: a whole-repo scan blocks the first commit on any
// codebase that isn't already green, which gets the hook bypassed rather than
// obeyed. Both of this skill's checks are per-file, so scoping the scan set is
// the whole implementation — see check-organization.js for the harder case
// where the property being checked spans files.
//
// Named paths that don't exist (a staged deletion) or aren't source files are
// dropped rather than erroring: the caller passes a commit's file list, not a
// curated one, and "that path is not something I check" is not a failure.
function resolveScope(root, names) {
  const out = [];
  for (const name of names) {
    const full = path.isAbsolute(name) ? name : path.join(root, name);
    if (!ALL_SOURCE_EXTENSIONS.includes(path.extname(full))) continue;
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
    else if (ALL_SOURCE_EXTENSIONS.includes(path.extname(e.name))) out.push(full);
  }
}

// Blanks out string/template/comment content (replacing with spaces,
// preserving newlines) so brace-depth counting below can't be thrown off
// by a brace appearing inside a string or a comment. Deliberately does NOT
// attempt to detect regex literals — distinguishing a regex-literal `/`
// from a division operator reliably needs a real tokenizer with full
// expression-context tracking, and a wrong guess there (mis-eating half
// the file as a "string") is a worse failure than the one real gap this
// leaves: a brace inside a regex quantifier like `/x{2,4}/` is not
// blanked, so it still contributes to brace-depth counting. Rare enough in
// practice to accept as a documented limitation rather than risk the
// worse bug.
function stripStringsAndComments(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '/' && next === '/') {
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
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += ' '; i++;
      while (i < n && text[i] !== quote) {
        if (text[i] === '\\' && i + 1 < n) {
          out += text[i] === '\n' ? '\n' : ' ';
          out += text[i + 1] === '\n' ? '\n' : ' ';
          i += 2;
          continue;
        }
        out += text[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) { out += ' '; i++; } // closing quote
      continue;
    }
    out += c;
    i++;
  }
  return out;
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
    skill: 'code-smells',
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

// Deepest brace nesting in already-cleaned source, or null if nothing exceeds
// the limit. Extracted from run()'s scan loop rather than left inline: nested
// inside the per-file loop it put its own result object literal at depth 6,
// which this very checker then reported against itself. Brace counting cannot
// tell a data literal from a control-flow block, so the fix is the one this
// skill's own catalog prescribes for a long function — extract the cohesive
// chunk and name it.
function deepestNestingIn(cleaned, rel) {
  let deepest = null;
  let depth = 0;
  let line = 1;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '\n') { line++; continue; }
    if (ch === '}') { depth = Math.max(0, depth - 1); continue; }
    if (ch !== '{') continue;
    depth++;
    if (depth > DEEP_NESTING_DEPTH && (!deepest || depth > deepest.depth)) deepest = { rel, line, depth };
  }
  return deepest;
}

function run(root, opts = {}) {
  assertReadableRoot(root);
  const files = [];
  const truncated = { hit: false };
  const scoped = Array.isArray(opts.files);
  if (scoped) files.push(...resolveScope(root, opts.files));
  else walk(root, files, truncated);

  if (files.length === 0) {
    return [check('S-scope', 'pass', scoped
      ? 'no source files among the named paths; size/nesting checks not applicable'
      : 'no source files found; size/nesting checks not applicable')];
  }

  const largeFiles = [];
  let deepest = null; // { rel, line, depth }
  let skippedForSize = 0;
  let braceFilesScanned = 0;

  for (const file of files) {
    let text;
    try {
      const stat = fs.statSync(file);
      if (stat.size > MAX_FILE_BYTES) { skippedForSize++; continue; }
      text = fs.readFileSync(file, 'utf8');
    } catch { continue; }

    const rel = path.relative(root, file).split(path.sep).join('/');
    // Line count needs no language-specific parsing — checked for every
    // source file found, not just brace languages.
    // A single trailing newline terminates the last line rather than starting a
    // new one — counting it made every file read as one line longer than it is,
    // so a file exactly at the limit was reported as over it.
    const lineCount = text.replace(/\n$/, '').split('\n').length;
    if (lineCount > LARGE_FILE_LINES) largeFiles.push(`${rel} (${lineCount} lines)`);

    // Line count alone is defeated by minified or generated code: a 200KB
    // bundle on one line reads as a 1-line file and passes cleanly. Longest
    // line is the cheap discriminator — human-authored source essentially
    // never has a 1000-character line, and minified output essentially always
    // does. Reported under the same check id because the reader's problem is
    // identical (a file nobody can read), with the reason spelled out.
    let longest = 0;
    for (const line of text.split('\n')) if (line.length > longest) longest = line.length;
    if (longest > MINIFIED_LINE_CHARS) {
      largeFiles.push(`${rel} (${longest}-char line — minified or generated; review the source it was built from, not this)`);
      continue; // brace-depth on minified code measures nothing
    }

    if (!BRACE_LANGUAGE_EXTENSIONS.has(path.extname(file))) continue;
    braceFilesScanned++;
    const found = deepestNestingIn(stripStringsAndComments(text), rel);
    if (found && (!deepest || found.depth > deepest.depth)) deepest = found;
  }

  const checks = [];
  checks.push(largeFiles.length > 0
    ? check('S-large-file', 'fail', `file(s) over ${LARGE_FILE_LINES} lines: ${largeFiles.join(', ')}`)
    : check('S-large-file', 'pass', `no file over ${LARGE_FILE_LINES} lines (${files.length} file(s) scanned)`));
  checks.push(braceFilesScanned === 0
    ? check('S-deep-nesting', 'pass', 'no brace-delimited-language files found (see SKILL.md for language scope); nesting check not applicable')
    : deepest
      ? check('S-deep-nesting', 'fail', `nesting depth ${deepest.depth} (over ${DEEP_NESTING_DEPTH}) at ${deepest.rel}:${deepest.line}`)
      : check('S-deep-nesting', 'pass', `no nesting deeper than ${DEEP_NESTING_DEPTH} (${braceFilesScanned} file(s) scanned)`));

  const notes = [];
  if (skippedForSize > 0) notes.push(`${skippedForSize} file(s) skipped (over size cap)`);
  if (truncated.hit) notes.push('file walk hit the safety cap; scan may not cover the whole tree');
  if (notes.length > 0) checks.push(check('S-scan-completeness', 'not_evaluated', notes.join('; ')));

  return checks;
}

function finish(checks, args, exitCode) {
  const report = makeReport(checks);
  const json = JSON.stringify(report, null, 2);
  if (args.reportPath) fs.writeFileSync(args.reportPath, json + '\n');
  console.log(json);
  process.exit(exitCode);
}

module.exports = { run, stripStringsAndComments };

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  try {
    const checks = run(args.root, { files: args.files });
    const hasFail = checks.some((c) => c.status === 'fail');
    const exitCode = hasFail ? 1 : args.strict && checks.some((c) => c.status !== 'pass') ? 1 : 0;
    finish(checks, args, exitCode);
  } catch (e) {
    finish([check('S-internal-error', 'fail', e.message)], args, 3);
  }
}
