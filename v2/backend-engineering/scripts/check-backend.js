#!/usr/bin/env node
'use strict';
// Backend gate: trusted-side laws that are measurable. One ORM, no secret
// material in client-reachable paths, architecture doc present when the
// system is multi-part.
//
// Usage: node check-backend.js --root <dir> [--strict] [--out <file>] [--no-write]

const path = require('path');
const { corePaths } = require('./resolve-core.cjs');
const core = corePaths();
const { parseArgs } = require(path.join(core.lib, 'args.cjs'));
const { classify, ARCH_DOC_CANDIDATES } = require(path.join(core.lib, 'classify.cjs'));
const { check, runCli } = require(path.join(core.lib, 'report.cjs'));
const registry = require(core.registry);

const { SECRET_PATTERNS } = require(path.join(core.lib, 'secret-patterns.cjs'));

const ORM_DEPS = ['prisma', '@prisma/client', 'typeorm', 'sequelize', 'mongoose', 'knex', 'drizzle-orm'];

const SCANNED_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.jsx', '.ts', '.tsx', '.css', '.vue', '.svelte']);

// DENY-list of server-only paths, not an allow-list of client paths. A
// framework like Next.js/Remix mixes client and server code across
// app/, pages/, components/ with no directory boundary a regex can trust —
// so the safe default is "scan everything that could conceivably reach the
// client, except what's provably server-only", not the reverse. The v0.4
// design (allow-list of public/static/client/src) missed app/pages/components
// entirely and simultaneously false-flagged genuine server code under src/.
const SERVER_ONLY_PATTERNS = [
  /(^|\/)server\.(js|mjs|cjs|ts)$/,   // server.js, src/server.ts, lib/server.js
  /(^|\/)server\//,                    // a dedicated server/ directory at any depth
  /(^|\/)api\//,                       // pages/api/, app/api/, generic api/ (Next/Remix route handlers)
  /\.server\.(js|jsx|ts|tsx|mjs|cjs)$/, // *.server.ts convention (Remix, etc.)
];

function isServerOnlyPath(relPath) {
  return SERVER_ONLY_PATTERNS.some((p) => p.test(relPath));
}

function run(root) {
  const cls = classify(root, { evidenceDir: registry.evidenceDir });
  const checks = [];

  if (!cls.serverPresent) {
    checks.push(check('B-scope', 'pass', 'no server detected; backend gate not required'));
    return checks;
  }

  // Architecture doc (required only when multi-part; single-part servers pass).
  if (cls.multiPart) {
    checks.push(cls.archDocPath
      ? check('B-arch-doc', 'pass', cls.archDocPath)
      : check('B-arch-doc', 'fail',
          `multi-part project has no architecture doc (looked for: ${ARCH_DOC_CANDIDATES.join(', ')})`));
  } else {
    checks.push(check('B-arch-doc', 'pass', 'single-part server; architecture doc not required'));
  }

  // One ORM.
  if (!cls.pkg) {
    checks.push(check('B-dual-orm', 'not_evaluated', 'no package.json readable'));
  } else {
    const orms = ORM_DEPS.filter((d) => d in cls.deps)
      .map((d) => (d === '@prisma/client' ? 'prisma' : d));
    const unique = [...new Set(orms)];
    checks.push(unique.length > 1
      ? check('B-dual-orm', 'fail', `multiple ORMs in dependencies: ${unique.join(', ')}`)
      : check('B-dual-orm', 'pass', unique[0] ? `orm: ${unique[0]}` : 'no orm'));
  }

  // No secret material in client-reachable paths. Reports FILE PATHS ONLY,
  // never the matched value. Files above the safe-read size cap are skipped
  // and counted, not silently treated as clean.
  const hits = [];
  let skippedForSize = 0;
  for (let i = 0; i < cls.files.length; i++) {
    const rel = cls.rel[i];
    if (isServerOnlyPath(rel)) continue;
    if (!SCANNED_EXTENSIONS.has(path.extname(rel))) continue;
    const text = cls.readFileSafe(i);
    if (text === null) {
      skippedForSize++;
      continue;
    }
    if (SECRET_PATTERNS.some((p) => p.test(text))) hits.push(rel);
  }
  checks.push(hits.length > 0
    ? check('B-client-secrets', 'fail', `secret-shaped values in client-reachable paths: ${hits.join(', ')}`)
    : check('B-client-secrets', 'pass', 'no secret-prefixed values in client-reachable paths'));
  const completenessNotes = [];
  if (skippedForSize > 0) completenessNotes.push(`${skippedForSize} file(s) skipped (over size cap)`);
  if (cls.truncated) completenessNotes.push('file walk hit the safety cap; scan may not cover the whole tree');
  if (completenessNotes.length > 0) {
    checks.push(check('B-scan-completeness', 'not_evaluated', completenessNotes.join('; ')));
  }

  return checks;
}

module.exports = { run, isServerOnlyPath };

if (require.main === module) {
  const artifact = registry.artifacts.find((a) => a.producer === 'backend-engineering' && a.kind === 'report');
  runCli({
    skill: 'backend-engineering',
    reportFile: path.basename(artifact.file),
    evidenceDir: registry.evidenceDir,
    runFn: run,
    argv: process.argv.slice(2),
    parseArgs,
  });
}
