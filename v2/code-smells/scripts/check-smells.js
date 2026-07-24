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

function parseArgs(argv) {
  const out = { root: '.', strict: false, reportPath: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') out.root = argv[++i];
    else if (a === '--strict') out.strict = true;
    else if (a === '--report' || a === '--out') out.reportPath = argv[++i];
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

function run(root) {
  const files = [];
  const truncated = { hit: false };
  walk(root, files, truncated);

  if (files.length === 0) {
    return [check('S-scope', 'pass', 'no source files found; size/nesting checks not applicable')];
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
    const lineCount = text.split('\n').length;
    if (lineCount > LARGE_FILE_LINES) largeFiles.push(`${rel} (${lineCount} lines)`);

    if (!BRACE_LANGUAGE_EXTENSIONS.has(path.extname(file))) continue;
    braceFilesScanned++;
    const cleaned = stripStringsAndComments(text);
    let depth = 0;
    let line = 1;
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (ch === '\n') { line++; continue; }
      if (ch === '{') {
        depth++;
        if (depth > DEEP_NESTING_DEPTH && (!deepest || depth > deepest.depth)) {
          deepest = { rel, line, depth };
        }
      } else if (ch === '}') {
        depth = Math.max(0, depth - 1);
      }
    }
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
    const checks = run(args.root);
    const hasFail = checks.some((c) => c.status === 'fail');
    const exitCode = hasFail ? 1 : args.strict && checks.some((c) => c.status !== 'pass') ? 1 : 0;
    finish(checks, args, exitCode);
  } catch (e) {
    finish([check('S-internal-error', 'fail', e.message)], args, 3);
  }
}
