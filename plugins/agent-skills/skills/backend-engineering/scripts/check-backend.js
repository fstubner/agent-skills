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
  /(^|\/)(?:pages|app)\/api\//,       // Next.js pages/api and app/api route handlers
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
// Pass 1 supplies gitleaks' defaults EXPLICITLY rather than letting it fall
// through to auto-discovering <source>/.gitleaks.toml. The audited repo does
// not get a vote on how it is audited: without this, a repo shipping
// `[allowlist] paths = [".*"]` turned a live token from fail to pass. See
// core/gitleaks-defaults.toml.
const DEFAULT_GITLEAKS_CONFIG = path.join(core.lib, '..', 'gitleaks-defaults.toml');
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
    // Neutralise the two in-tree bypasses the audited repo would otherwise
    // control: an inline `gitleaks:allow` comment on the offending line, and
    // a planted .gitleaksignore. Both live inside the tree being scanned.
    '--ignore-gitleaks-allow',
    '--gitleaks-ignore-path', tmpDir,
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
      runGitleaksPass(root, ['--config', DEFAULT_GITLEAKS_CONFIG], tmpDir, 'default'),
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

// ---------- Session-cookie flags (law 6's measurable projection) ----------
// Authorization and rate limiting are judgment-verified — no static check
// can tell a correct ownership check from a plausible-looking one. Cookie
// flags are the exception: whether a session cookie was set HttpOnly,
// Secure and SameSite is a syntactic fact, and getting it wrong is the
// single most common way a session is handed to an attacker.
//
// Scoped to SESSION-LIKE cookie names on purpose. Requiring HttpOnly on
// every cookie would false-flag the deliberately JS-readable ones (theme,
// locale, and the CSRF token in the double-submit pattern, which must be
// readable by design) — so the check would be noise and get ignored.
const SOURCE_EXT = /\.(c|m)?[jt]sx?$|\.(py|go|rb|php|java|rs)$/;
const COOKIE_SET_PATTERNS = [
  /\bres\.cookie\s*\(/g,                    // Express
  /\breply\.setCookie\s*\(/g,               // Fastify
  /\bcookies\s*\(\s*\)\s*\.set\s*\(/g,      // Next.js app router
  /\bcookies\.set\s*\(/g,                   // Koa (ctx.cookies.set), Sveltekit
  /\bsetCookie\s*\(/g,                      // Hono, generic helpers
  /\bset_cookie\s*\(/g,                     // Flask, Django, Starlette
  /\bSetCookie\s*\(/g,                      // Go (http.SetCookie)
];
const SESSION_NAME = /sess|sid|auth|token|jwt|login|refresh|access|identity|remember/i;
const NOT_SESSION_NAME = /csrf|xsrf/i;
const REQUIRED_COOKIE_FLAGS = [
  { name: 'httpOnly', present: /http_?only/i, disabled: /http_?only\s*[:=]\s*(false|0|nil)\b/i },
  { name: 'secure', present: /\bsecure\b/i, disabled: /\bsecure\s*[:=]\s*(false|0|nil)\b/i },
  // SameSite=None is not a weaker setting of the flag, it is the absence of
  // the protection the flag exists for — cross-site requests carry the
  // cookie again.
  { name: 'sameSite', present: /same_?site/i, disabled: /same_?site\s*[:=]\s*(false|["']?none["']?|http\.SameSiteNoneMode)\b/i },
];
const MAX_CALL_CHARS = 1200;

// The call's own argument text, from the opening paren to its match. Naive
// depth counting: a paren inside a string literal would end the slice early,
// which can only SHORTEN what we look at — the failure direction is a missed
// flag, i.e. a false BLOCK the author fixes by writing the flag, never a
// silent pass.
function callSlice(text, openParenIndex) {
  let depth = 0;
  const end = Math.min(text.length, openParenIndex + MAX_CALL_CHARS);
  for (let i = openParenIndex; i < end; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(openParenIndex, i + 1);
  }
  return text.slice(openParenIndex, end);
}

function cookieFindingsIn(relPath, text) {
  const findings = [];
  for (const pattern of COOKIE_SET_PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const slice = callSlice(text, m.index + m[0].length - 1);
      const nameMatch = /['"`]([^'"`]{1,64})['"`]/.exec(slice);
      const name = nameMatch ? nameMatch[1] : '';
      if (!SESSION_NAME.test(name) || NOT_SESSION_NAME.test(name)) continue;
      const optionsText = nameMatch
        ? slice.slice(0, nameMatch.index) + ' '.repeat(nameMatch[0].length) + slice.slice(nameMatch.index + nameMatch[0].length)
        : slice;
      const missing = REQUIRED_COOKIE_FLAGS
        .filter((f) => !f.present.test(optionsText) || f.disabled.test(optionsText))
        .map((f) => f.name);
      if (missing.length === 0) continue;
      const line = text.slice(0, m.index).split('\n').length;
      findings.push(`${relPath}:${line} cookie "${name}" missing ${missing.join(', ')}`);
    }
  }
  return findings;
}

function scanSessionCookies(cls) {
  const findings = [];
  let scanned = 0;
  for (let i = 0; i < cls.rel.length; i++) {
    if (!SOURCE_EXT.test(cls.rel[i])) continue;
    const text = cls.readFileSafe(i);
    if (text === null) continue;
    scanned++;
    findings.push(...cookieFindingsIn(cls.rel[i], text));
  }
  if (findings.length > 0) {
    return check('B-session-cookie', 'fail', findings.join('; '));
  }
  return check('B-session-cookie', 'pass',
    `no session cookie set without HttpOnly/Secure/SameSite (${scanned} source file(s) scanned)`);
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
  checks.push(scanSessionCookies(cls));
  if (cls.truncated) {
    checks.push(check('B-scan-completeness', 'not_evaluated',
      'project-type file walk hit the safety cap; server/frontend/multi-part detection may be incomplete'));
  }

  return checks;
}

module.exports = { run, isServerOnlyPath, cookieFindingsIn };

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
