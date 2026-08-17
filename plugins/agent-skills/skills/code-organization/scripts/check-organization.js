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
const NEWLINE = String.fromCharCode(10); // line separator for --files-from
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo', '.agent-evidence', 'fixtures', 'testdata', 'examples', '.claude', '.cursor', '.codex', '.agents', '.aider', '.worktrees']);
const MAX_FILES = 20000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

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
    // Same scan-set restriction as --files, read from a newline-delimited
    // file. A commit touching a couple of thousand paths overflows the
    // command line (ENAMETOOLONG on Windows), and the pre-commit hook then
    // SKIPPED this checker with a warning — a gate that silently stops
    // running on exactly the largest commits.
    else if (a === '--files-from') {
      const p = argv[++i];
      let text = '';
      try { text = fs.readFileSync(p, 'utf8'); } catch { text = ''; }
      out.files = (out.files || []).concat(text.split(NEWLINE).map((s) => s.trim()).filter(Boolean));
    }
  }
  return out;
}

// --files scopes what may FAIL to specific paths, for pre-commit-hook use
// (a whole-repo scan blocks the first commit on any codebase that isn't
// already green, which gets the hook bypassed rather than obeyed).
//
// Unlike code-smells, scoping here CANNOT mean "only scan these files": a
// cycle a -> b -> c -> a is a property of the graph, and two of those three
// files may be untouched by the commit. So the whole graph is still built
// from a full walk and only the REPORTING is scoped — a cycle blocks when a
// named file participates in it. A pre-existing cycle the commit doesn't
// touch is grandfathered; introducing one, or editing a file already inside
// one, is not.
function resolveScope(root, names) {
  const out = [];
  for (const name of names) {
    const full = path.resolve(path.isAbsolute(name) ? name : path.join(root, name));
    try {
      if (!fs.statSync(full).isFile()) continue;
    } catch { continue; }
    out.push(full);
  }
  return out;
}

// Finds a cycle that passes through `start` specifically: a path
// start -> ... -> start. Deliberately separate from findCycle()'s global
// three-colour DFS, which returns the first cycle anywhere and marks nodes
// BLACK as it goes — that early-exit makes "find a cycle containing THIS
// node" unanswerable without re-running it per node anyway. Scope sets are
// one commit's worth of files, so the per-start cost is bounded.
function findCycleThrough(graph, start) {
  const stack = [];
  const onStack = new Set();
  const visited = new Set([start]);
  let found = null;

  function dfs(node) {
    stack.push(node);
    onStack.add(node);
    for (const next of graph.get(node) || []) {
      if (next === start) {
        found = [...stack, start];
        return true;
      }
      if (!visited.has(next) && !onStack.has(next)) {
        visited.add(next);
        if (dfs(next)) return true;
      }
    }
    stack.pop();
    onStack.delete(node);
    return false;
  }

  dfs(start);
  return found;
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
// The clause matcher is `[^;]*?`, NOT `[^\n]*?`. Newlines are legal inside an
// import clause and Prettier splits any list past its print width, so a
// line-bounded matcher missed the majority of import edges in a normally
// formatted TS codebase while still reporting "N file(s) scanned". `;` is the
// statement boundary, so the clause cannot bleed into the next statement, and
// two imports on one line are both found.
//
// Covers, in order: import/export ... from '<rel>' (value imports AND re-export
// barrels, the single most common real source of cycles); bare side-effect
// `import '<rel>'`; require('<rel>'); dynamic import('<rel>').
const IMPORT_RE = /\b(?:import|export)\b[^;]*?\bfrom\s*['"](\.[^'"]+)['"]|\bimport\s*['"](\.[^'"]+)['"]|\brequire\(\s*['"](\.[^'"]+)['"]\s*\)|\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g;

function nonCodeRanges(text) {
  const ranges = [];
  let i = 0;
  while (i < text.length) {
    const start = i;
    if (text[i] === '/' && text[i + 1] === '/') {
      i += 2; while (i < text.length && text[i] !== '\n') i++;
      ranges.push([start, i]); continue;
    }
    if (text[i] === '/' && text[i + 1] === '*') {
      i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i = Math.min(text.length, i + 2); ranges.push([start, i]); continue;
    }
    if (text[i] === '"' || text[i] === "'" || text[i] === '`') {
      const quote = text[i++];
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i++] === quote) break;
      }
      ranges.push([start, i]); continue;
    }
    i++;
  }
  return ranges;
}

function localImportsOf(text) {
  const specs = [];
  const ranges = nonCodeRanges(text);
  let rangeIndex = 0;
  for (const m of text.matchAll(IMPORT_RE)) {
    while (ranges[rangeIndex] && ranges[rangeIndex][1] <= m.index) rangeIndex++;
    if (ranges[rangeIndex] && ranges[rangeIndex][0] <= m.index) continue;
    // `import type` / `export type` are erased at compile time and create no
    // runtime cycle — flagging them would false-positive on an idiomatic TS
    // pattern (two modules whose types reference each other).
    if (/^\s*(?:import|export)\s+type\b/.test(m[0])) continue;
    const spec = m[1] || m[2] || m[3] || m[4];
    if (spec) specs.push(spec);
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

// walk() swallows readdirSync errors so an unreadable SUBdirectory can't abort
// a scan. Applied to the root itself that turned a typo'd --root into "zero
// files" -> "not applicable" -> pass -> SHIP. "I scanned it and found nothing"
// and "I could not scan it" are different claims; only the first may pass.
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
  // The full walk happens even when scoped — the graph must be complete for
  // cycle detection to be correct; only the reporting is narrowed below.
  walk(root, files, truncated);

  const scoped = Array.isArray(opts.files);
  const scopeFiles = scoped ? resolveScope(root, opts.files) : [];

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
  let cycle = null;
  if (scoped) {
    for (const f of scopeFiles) {
      if (!graph.has(f)) continue;
      cycle = findCycleThrough(graph, f);
      if (cycle) break;
    }
  } else {
    cycle = findCycle(graph);
  }
  if (cycle) {
    const rel = cycle.map((f) => path.relative(root, f).split(path.sep).join('/'));
    checks.push(check('O-circular-deps', 'fail', `circular import: ${rel.join(' -> ')}`));
  } else if (scoped) {
    checks.push(check('O-circular-deps', 'pass',
      `${scopeFiles.length} named file(s) are in no circular import (${files.length} file(s) scanned to build the graph)`));
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
    const checks = run(args.root, { files: args.files });
    const hasFail = checks.some((c) => c.status === 'fail');
    const exitCode = hasFail ? 1 : args.strict && checks.some((c) => c.status !== 'pass') ? 1 : 0;
    finish(checks, args, exitCode);
  } catch (e) {
    finish([check('O-internal-error', 'fail', e.message)], args, 3);
  }
}
