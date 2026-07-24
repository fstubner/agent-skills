#!/usr/bin/env node
'use strict';
// Circular-import detector for JS/TS projects. This is the one rule from
// code-organization/SKILL.md that's genuinely binary and low-false-positive
// enough to check deterministically — a cycle either exists or it doesn't,
// unlike "is this module named well" or "is this the right abstraction,"
// which stay judgment calls (see SKILL.md).
//
// Deliberately self-contained (no core/lib dependency), like
// ai-prose-slop/scripts/check-prose.js, so this skill stays copy-anywhere
// and doesn't need the vendor/resolve-core plumbing the acceptance-gated
// skills use.
//
// Usage: node check-organization.js --root <dir> [--strict] [--report <path>]
// Exit codes: 0 clean (or findings without --strict), 1 a cycle was found
// (or --strict with any finding), 3 internal error.

const fs = require('fs');
const path = require('path');

const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo', '.agent-evidence']);
const MAX_FILES = 20000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

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
    if (e.isDirectory()) {
      walk(full, out, truncated);
    } else if (SCAN_EXTENSIONS.includes(path.extname(e.name))) {
      out.push(full);
    }
  }
}

// Extracts local (relative) import/require specifiers only — a package
// import ("react", "lodash") can't participate in an internal-module cycle
// this check cares about, and including them would just add noise.
// `import type { X } from './y'` is deliberately excluded: a type-only
// reference is erased at compile time and creates no runtime cycle, so
// flagging it would be a real false positive on an idiomatic TS pattern.
const IMPORT_RE = /(?:^|\n)\s*import\s+type\s[^\n]*from\s*['"](\.[^'"]+)['"]|(?:^|\n)\s*import\b[^\n]*?\bfrom\s*['"](\.[^'"]+)['"]|\brequire\(\s*['"](\.[^'"]+)['"]\s*\)|\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g;

function localImportsOf(text) {
  const specs = [];
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(text))) {
    // Group 1 = type-only import target (skipped); groups 2-4 = real ones.
    if (m[2]) specs.push(m[2]);
    if (m[3]) specs.push(m[3]);
    if (m[4]) specs.push(m[4]);
  }
  return specs;
}

// Resolves a relative specifier to one of the files actually on disk in
// `known` (a Set of absolute, normalized paths) — tries the exact path,
// each scan extension appended, then the same with /index.<ext>. Returns
// null (not undefined) for "resolves outside the scanned set or doesn't
// exist" so an unresolved import is silently excluded from the graph
// rather than crashing the walk — a broken import path is a different
// problem than a circular one.
function resolveSpecifier(fromFile, spec, known) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, ...SCAN_EXTENSIONS.map((e) => base + e),
    ...SCAN_EXTENSIONS.map((e) => path.join(base, 'index' + e))];
  for (const c of candidates) {
    if (known.has(c)) return c;
  }
  return null;
}

// Depth-first cycle search. Returns the first cycle found as an array of
// file paths (a, b, c, a) or null if the graph is acyclic. Not exhaustive
// (a real project can have many independent cycles) — reporting the first
// one found is enough to act on; fixing it and re-running surfaces the next.
function findCycle(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const stack = [];
  for (const node of graph.keys()) color.set(node, WHITE);

  function visit(node) {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of graph.get(node) || []) {
      const c = color.get(next);
      if (c === GRAY) {
        const cycleStart = stack.indexOf(next);
        return [...stack.slice(cycleStart), next];
      }
      if (c === WHITE) {
        const found = visit(next);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return null;
  }

  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) {
      const found = visit(node);
      if (found) return found;
    }
  }
  return null;
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
    skill: 'code-organization',
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
    return [check('O-scope', 'pass', 'no JS/TS files found; circular-dependency check not applicable')];
  }

  // Absolute paths throughout: resolveSpecifier resolves relative specifiers
  // to absolute paths via path.resolve, so `known` and the graph's own keys
  // must also be absolute or the Set/Map lookups silently never match —
  // caught by the circular fixture never actually flagging a cycle before
  // this fix.
  const absFiles = files.map((f) => path.resolve(f));
  const known = new Set(absFiles);
  const graph = new Map();
  let skippedForSize = 0;
  for (const file of absFiles) {
    let text;
    try {
      const stat = fs.statSync(file);
      if (stat.size > MAX_FILE_BYTES) { skippedForSize++; graph.set(file, []); continue; }
      text = fs.readFileSync(file, 'utf8');
    } catch { graph.set(file, []); continue; }
    const targets = [];
    for (const spec of localImportsOf(text)) {
      const resolved = resolveSpecifier(file, spec, known);
      if (resolved) targets.push(resolved);
    }
    graph.set(file, targets);
  }

  const checks = [];
  const cycle = findCycle(graph);
  if (cycle) {
    const rel = cycle.map((f) => path.relative(root, f).split(path.sep).join('/'));
    checks.push(check('O-circular-deps', 'fail', `circular import: ${rel.join(' -> ')}`));
  } else {
    checks.push(check('O-circular-deps', 'pass', `${files.length} file(s) scanned, no circular imports`));
  }

  const notes = [];
  if (skippedForSize > 0) notes.push(`${skippedForSize} file(s) skipped (over size cap)`);
  if (truncated.hit) notes.push('file walk hit the safety cap; scan may not cover the whole tree');
  if (notes.length > 0) checks.push(check('O-scan-completeness', 'not_evaluated', notes.join('; ')));

  return checks;
}

function finish(checks, args, exitCode) {
  const report = makeReport(checks);
  const json = JSON.stringify(report, null, 2);
  if (args.reportPath) fs.writeFileSync(args.reportPath, json + '\n');
  console.log(json);
  process.exit(exitCode);
}

module.exports = { run, findCycle, localImportsOf };

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  try {
    const checks = run(args.root);
    const hasFail = checks.some((c) => c.status === 'fail');
    const exitCode = hasFail ? 1 : args.strict && checks.some((c) => c.status !== 'pass') ? 1 : 0;
    finish(checks, args, exitCode);
  } catch (e) {
    finish([check('O-internal-error', 'fail', e.message)], args, 3);
  }
}
