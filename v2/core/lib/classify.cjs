'use strict';

// The ONE project classifier. Every checker and the acceptance gate use this
// — no per-skill re-derivation of scope, so gates can't disagree about what
// kind of project they're looking at (v0.4 had four competing heuristics).

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.agent-evidence', 'dist', 'build', 'coverage',
  '.next', '.svelte-kit', 'vendor',
]);

// Shared arch-doc candidate list — previously duplicated and drifted between
// checkers, producing contradictory verdicts on case-sensitive filesystems.
const ARCH_DOC_CANDIDATES = [
  'ARCHITECTURE.md',
  'architecture.md',
  path.join('docs', 'ARCHITECTURE.md'),
  path.join('docs', 'architecture.md'),
];

const SERVER_DEPS = ['express', 'fastify', 'koa', 'hono', '@nestjs/core', 'next'];
const FRONTEND_DEPS = ['react', 'vue', 'svelte', '@angular/core', 'solid-js', 'preact', 'next'];

function listFiles(root, maxDepth = 4) {
  const out = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.agent-evidence') {
        if (e.isDirectory()) continue;
      }
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(full, depth + 1);
      } else {
        out.push(full);
      }
    }
  }
  walk(root, 0);
  return out;
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

function classify(root) {
  const files = listFiles(root);
  // IMPORTANT: all signal matching happens on paths RELATIVE to root — the
  // absolute location of the checkout must never change a verdict.
  const rel = files.map((f) => path.relative(root, f).split(path.sep).join('/'));
  const pkg = readPackageJson(root);
  const deps = allDeps(pkg);

  const serverPresent =
    rel.some((f) => /^(server|api)\.(c|m)?js$/.test(f) || /^(server|api)\/.+\.(c|m)?(j|t)s$/.test(f)) ||
    SERVER_DEPS.some((d) => d in deps);

  const frontendPresent =
    rel.some((f) => /(^|\/)index\.html$/.test(f) || /^public\//.test(f) || /\.(jsx|tsx|vue|svelte)$/.test(f)) ||
    FRONTEND_DEPS.some((d) => d in deps);

  // Multi-part means real trust boundaries: client + server, or an explicit
  // workspace split. A bare go.mod/Cargo.toml does NOT make a library "multi".
  const multiPart =
    (serverPresent && frontendPresent) ||
    Boolean(pkg && Array.isArray(pkg.workspaces) && pkg.workspaces.length > 1);

  let archDocPath = null;
  for (const cand of ARCH_DOC_CANDIDATES) {
    if (fs.existsSync(path.join(root, cand))) {
      archDocPath = cand.split(path.sep).join('/');
      break;
    }
  }

  return { root, files, rel, pkg, deps, serverPresent, frontendPresent, multiPart, archDocPath };
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

module.exports = { classify, conditionMet, listFiles, ARCH_DOC_CANDIDATES };
