'use strict';

// The ONE project classifier. Every checker and the acceptance gate use this
// — no per-skill re-derivation of scope, so gates can't disagree about what
// kind of project they're looking at (v0.4 had four competing heuristics).

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.next', '.svelte-kit', 'vendor',
]);

// Files this large are almost never source; skip them rather than risk an
// OOM on a committed binary or data dump that happens to match a scanned
// extension. Skipped files are recorded so callers can report the gap
// instead of silently treating "not read" as "clean".
const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Hard cap on total files walked — a safety valve against pathological
// trees, not a normal-project limit (SKIP_DIRS already excludes the big
// generated directories). Exceeding it means the classification is
// incomplete, which callers should treat as evidence of that, not silence.
const MAX_FILES = 50000;

// Shared arch-doc candidate list — previously duplicated and drifted between
// checkers, producing contradictory verdicts on case-sensitive filesystems.
const ARCH_DOC_CANDIDATES = [
  'ARCHITECTURE.md',
  'architecture.md',
  path.join('docs', 'ARCHITECTURE.md'),
  path.join('docs', 'architecture.md'),
];

// A standalone server dependency implies a genuinely separate deployable —
// combined with a frontend, that's a real multi-part / trust-boundary
// system. A full-stack framework dependency (next: API routes, RSC) means
// server code runs, so backend laws (secrets, ORM) still apply — but it is
// ONE deployable, not automatically multi-part. Conflating the two used to
// force every Next.js app to write ARCHITECTURE.md (Parts/Boundaries/Trust)
// for a boundary that doesn't exist; the split below fixes that while still
// scanning Next server code for secrets.
const STANDALONE_SERVER_DEPS = ['express', 'fastify', 'koa', 'hono', '@nestjs/core'];
const FULLSTACK_FRAMEWORK_DEPS = ['next'];
const FRONTEND_DEPS = ['react', 'vue', 'svelte', '@angular/core', 'solid-js', 'preact', 'next'];

function listFiles(root, evidenceDirName) {
  const out = [];
  let truncated = false;
  function walk(dir) {
    if (out.length >= MAX_FILES) {
      truncated = true;
      return;
    }
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || e.name === evidenceDirName) continue;
        walk(path.join(dir, e.name));
      } else {
        out.push(path.join(dir, e.name));
        if (out.length >= MAX_FILES) {
          truncated = true;
          return;
        }
      }
    }
  }
  walk(root);
  return { files: out, truncated };
}

function readPackageJson(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

function allDeps(pkg) {
  if (!pkg) return {};
  return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
}

// Safe read: skips files above MAX_FILE_BYTES (returns null, distinct from
// "" so callers don't mistake "skipped" for "empty and clean").
function readFileSafe(absPath) {
  try {
    const stat = fs.statSync(absPath);
    if (stat.size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
}

function classify(root, opts = {}) {
  const evidenceDirName = opts.evidenceDir || '.agent-evidence';
  const { files, truncated } = listFiles(root, evidenceDirName);
  // IMPORTANT: all signal matching happens on paths RELATIVE to root — the
  // absolute location of the checkout must never change a verdict.
  const rel = files.map((f) => path.relative(root, f).split(path.sep).join('/'));
  const pkg = readPackageJson(root);
  const deps = allDeps(pkg);

  const explicitServerFile =
    rel.some((f) => /^(server|api)\.(c|m)?js$/.test(f) || /^(server|api)\/.+\.(c|m)?(j|t)s$/.test(f));
  const standaloneServerDep = STANDALONE_SERVER_DEPS.some((d) => d in deps);
  const fullstackFrameworkDep = FULLSTACK_FRAMEWORK_DEPS.some((d) => d in deps);

  // serverPresent: server code exists and backend laws (secrets, ORM) apply.
  const serverPresent = explicitServerFile || standaloneServerDep || fullstackFrameworkDep;
  // distinctServerPresent: server code lives in a deployable separate from
  // the frontend — the signal multi-part boundary decisions should key on.
  const distinctServerPresent = explicitServerFile || standaloneServerDep;

  const frontendPresent =
    rel.some((f) => /(^|\/)index\.html$/.test(f) || /^public\//.test(f) || /\.(jsx|tsx|vue|svelte)$/.test(f)) ||
    FRONTEND_DEPS.some((d) => d in deps);

  // Multi-part means real trust boundaries: a distinct server plus a
  // frontend, or an explicit workspace split. A bare go.mod/Cargo.toml does
  // NOT make a library "multi"; neither does a full-stack framework's own
  // built-in server capability running in the same deployable as its UI.
  const multiPart =
    (distinctServerPresent && frontendPresent) ||
    Boolean(pkg && Array.isArray(pkg.workspaces) && pkg.workspaces.length > 1);

  let archDocPath = null;
  for (const cand of ARCH_DOC_CANDIDATES) {
    if (fs.existsSync(path.join(root, cand))) {
      archDocPath = cand.split(path.sep).join('/');
      break;
    }
  }

  return { root, files, rel, pkg, deps, serverPresent, distinctServerPresent, frontendPresent, multiPart, archDocPath, truncated, readFileSafe: (i) => readFileSafe(files[i]) };
}

// requiredWhen conditions used by registry.json artifacts.
function conditionMet(condition, cls) {
  switch (condition) {
    case 'always': return true;
    case 'never': return false;
    case 'multi_part': return cls.multiPart;
    case 'server_present': return cls.serverPresent;
    case 'frontend_present': return cls.frontendPresent;
    default:
      throw new Error(`Unknown requiredWhen condition "${condition}" — add it to classify.cjs`);
  }
}

const KNOWN_REQUIRED_WHEN = ['always', 'never', 'multi_part', 'server_present', 'frontend_present'];

module.exports = { classify, conditionMet, listFiles, readFileSafe, ARCH_DOC_CANDIDATES, KNOWN_REQUIRED_WHEN, MAX_FILE_BYTES };
