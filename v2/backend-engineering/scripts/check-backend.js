#!/usr/bin/env node
'use strict';
// Backend gate: trusted-side laws that are measurable. One ORM, no secret
// material in client-served paths, architecture doc present when the system
// is multi-part.
//
// Usage: node check-backend.js --root <dir> [--strict] [--out <file>] [--no-write]

const fs = require('fs');
const path = require('path');
const { corePaths } = require('./resolve-core.cjs');
const core = corePaths();
const { parseArgs } = require(path.join(core.lib, 'args.cjs'));
const { classify, ARCH_DOC_CANDIDATES } = require(path.join(core.lib, 'classify.cjs'));
const { check, runCli } = require(path.join(core.lib, 'report.cjs'));
const registry = require(core.registry);

const ORM_DEPS = ['prisma', '@prisma/client', 'typeorm', 'sequelize', 'mongoose', 'knex', 'drizzle-orm'];

// Anchored, prefix-based secret patterns ONLY. The v0.4 scanner used
// /sk-[a-zA-Z0-9]{10,}/ with no boundary and BLOCKed projects for containing
// the phrase "task-management". Every pattern here requires a real key prefix.
const SECRET_PATTERNS = [
  /\bsk_(live|test)_[A-Za-z0-9]{10,}/,        // Stripe
  /\bsk-ant-[A-Za-z0-9_-]{10,}/,              // Anthropic
  /\bsk-proj-[A-Za-z0-9_-]{10,}/,             // OpenAI project keys
  /\bAKIA[0-9A-Z]{16}\b/,                     // AWS access key id
  /\bghp_[A-Za-z0-9]{30,}\b/,                 // GitHub PAT
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,           // Slack
];

const CLIENT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.jsx', '.ts', '.tsx', '.css', '.vue', '.svelte']);

function isClientPath(relPath) {
  return /^(public|static|client|src)\//.test(relPath) || relPath.endsWith('.html');
}

function run(root) {
  const cls = classify(root);
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

  // No secret material in client-served paths. Reports FILE PATHS ONLY,
  // never the matched value.
  const hits = [];
  for (let i = 0; i < cls.files.length; i++) {
    const rel = cls.rel[i];
    if (!isClientPath(rel)) continue;
    if (!CLIENT_EXTENSIONS.has(path.extname(rel))) continue;
    let text;
    try {
      text = fs.readFileSync(cls.files[i], 'utf8');
    } catch {
      continue;
    }
    if (SECRET_PATTERNS.some((p) => p.test(text))) hits.push(rel);
  }
  checks.push(hits.length > 0
    ? check('B-client-secrets', 'fail', `secret-shaped values in client paths: ${hits.join(', ')}`)
    : check('B-client-secrets', 'pass', 'no secret-prefixed values in client paths'));

  return checks;
}

module.exports = { run };

if (require.main === module) {
  runCli({
    skill: 'backend-engineering',
    reportFile: 'backend-report.json',
    evidenceDir: registry.evidenceDir,
    runFn: run,
    argv: process.argv.slice(2),
    parseArgs,
  });
}
