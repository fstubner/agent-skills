#!/usr/bin/env node
'use strict';
// Backend gate: trusted-side laws that are measurable. One ORM, no secret
// material in client-reachable paths, architecture doc present when the
// system is multi-part.
//
// Usage: node check-backend.js --root <dir> [--strict] [--out <file>] [--no-write]

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const { corePaths } = require('./resolve-core.cjs');
const core = corePaths();
const { parseArgs } = require(path.join(core.lib, 'args.cjs'));
const { classify, ARCH_DOC_CANDIDATES, ORM_DEPS } = require(path.join(core.lib, 'classify.cjs'));
const { check, runCli } = require(path.join(core.lib, 'report.cjs'));
const registry = require(core.registry);

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

// Client-secret scanning shells out to `gitleaks` — a real, maintained
// secret-detection tool — rather than hand-rolled regex, the same "use the
// real tool" choice this suite already made for ai-prose-slop and vale.
// Run TWICE (default ruleset + core/gitleaks-extra.toml, a couple of
// provider prefixes the default doesn't cover) and merged — see that
// file's header for why two passes instead of one combined config.
const EXTRA_GITLEAKS_CONFIG = path.join(core.lib, '..', 'gitleaks-extra.toml');
const LEAKS_FOUND_CODE = 2; // distinct from gitleaks' own fixed exit 1 for an internal error

function gitleaksInstallHint() {
  if (process.platform === 'win32') return 'winget install Gitleaks.Gitleaks';
  if (process.platform === 'darwin') return 'brew install gitleaks';
  return 'See https://github.com/gitleaks/gitleaks#installing';
}

function isGitleaksOnPath() {
  const probe = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  return !probe.error && probe.status === 0;
}

function runGitleaksPass(root, configArgs, tmpDir, label) {
  const reportPath = path.join(tmpDir, `report-${label}.json`);
  const result = spawnSync('gitleaks', [
    'detect', '--no-git', '--source', root, '--no-banner', '--redact',
    '--report-format', 'json', '--report-path', reportPath,
    '--exit-code', String(LEAKS_FOUND_CODE),
    ...configArgs,
  ], { encoding: 'utf8' });

  if (result.error) return { leaks: [], crashed: true, detail: result.error.message };
  if (result.status !== 0 && result.status !== LEAKS_FOUND_CODE) {
    return { leaks: [], crashed: true, detail: result.stderr || '(no stderr)' };
  }
  try {
    return { leaks: JSON.parse(fs.readFileSync(reportPath, 'utf8')), crashed: false };
  } catch {
    if (result.status === LEAKS_FOUND_CODE) {
      return { leaks: [], crashed: true, detail: 'gitleaks reported leaks but its report file was unreadable' };
    }
    return { leaks: [], crashed: false }; // no report file on a clean run is gitleaks' normal behavior
  }
}

// Reports FILE PATHS ONLY, never the matched value (gitleaks --redact
// already withholds the secret itself; we only ever read RuleID/File/Line).
function scanForClientSecrets(root) {
  if (!isGitleaksOnPath()) {
    return check('B-client-secrets', 'not_evaluated',
      `gitleaks is not on PATH — client-secret scan not evaluated, not assumed clean. Install: ${gitleaksInstallHint()}`);
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-backend-gitleaks-'));
  let passes;
  try {
    passes = [
      runGitleaksPass(root, [], tmpDir, 'default'),
      runGitleaksPass(root, ['--config', EXTRA_GITLEAKS_CONFIG], tmpDir, 'extra'),
    ];
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  const crashedPass = passes.find((p) => p.crashed);
  if (crashedPass) {
    return check('B-client-secrets', 'fail', `gitleaks did not complete normally: ${crashedPass.detail}`);
  }
  const relOf = (absFile) => path.relative(root, absFile).split(path.sep).join('/');
  const clientLeaks = passes.flatMap((p) => p.leaks).filter((leak) => !isServerOnlyPath(relOf(leak.File)));
  return clientLeaks.length > 0
    ? check('B-client-secrets', 'fail',
        `secret(s) in client-reachable paths: ${clientLeaks.map((l) => `${relOf(l.File)} [${l.RuleID}]`).join(', ')}`)
    : check('B-client-secrets', 'pass', 'no secrets in client-reachable paths (gitleaks)');
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

  // One ORM per manifest — checked WITHIN each detected ecosystem
  // separately, not across all of them combined. A monorepo with a Python
  // service using SQLAlchemy and a Node service using Prisma is two
  // services each correctly using one ORM, not a dual-ORM smell; the smell
  // is two ORMs declared in the SAME manifest.
  if (cls.manifests.length === 0) {
    checks.push(check('B-dual-orm', 'not_evaluated', 'no recognized dependency manifest readable'));
  } else {
    const perManifestOrms = cls.manifests.map((m) => ({
      ecosystem: m.ecosystem,
      manifestFile: m.manifestFile,
      orms: [...new Set((ORM_DEPS[m.ecosystem] || []).filter((d) => m.depNames.has(d.toLowerCase())).map((d) => (d === '@prisma/client' ? 'prisma' : d)))],
    }));
    const dual = perManifestOrms.filter((m) => m.orms.length > 1);
    if (dual.length > 0) {
      checks.push(check('B-dual-orm', 'fail',
        dual.map((m) => `${m.manifestFile}: multiple ORMs (${m.orms.join(', ')})`).join('; ')));
    } else {
      const summary = perManifestOrms.filter((m) => m.orms.length > 0).map((m) => `${m.manifestFile}: ${m.orms.join(', ')}`);
      checks.push(check('B-dual-orm', 'pass', summary.length > 0 ? summary.join('; ') : 'no orm detected'));
    }
  }

  // No secret material in client-reachable paths — gitleaks does its own
  // file walk here (not classify()'s), so classify's own truncation is a
  // separate, narrower concern: it can only affect server/frontend/
  // multiPart detection (and so B-arch-doc indirectly), not this check.
  checks.push(scanForClientSecrets(root));
  if (cls.truncated) {
    checks.push(check('B-scan-completeness', 'not_evaluated',
      'project-type file walk hit the safety cap; server/frontend/multi-part detection may be incomplete'));
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
