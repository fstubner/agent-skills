#!/usr/bin/env node
// Backend verification (objective evidence only).
// Exit 1 on BLOCK when --strict.
//
// Usage:
//   node check-backend.js [--root <dir>] [--strict] [--out backend-report.json]

'use strict';

const fs = require('fs');
const path = require('path');

const classifyPath = path.join(__dirname, '..', '..', '_suite', 'lib', 'classify-project.js');
const { classifyProject, writeSuiteProfile } = require(classifyPath);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function readText(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function hasSection(text, names) {
  return names.some((n) => new RegExp(`^##\\s*${n}\\b`, 'im').test(text));
}

function pushCheck(checks, id, status, extra = {}) {
  checks.push({ id, status, ...extra });
}

function detectServer(root, suite) {
  const signals = [];
  const serverFiles = [
    'server.js',
    'server.ts',
    'server.mjs',
    'app.js',
    'src/server.js',
    'src/server.ts',
    'api/index.js',
    'api/index.ts',
  ];
  for (const f of serverFiles) {
    if (exists(root, f)) signals.push(f);
  }
  if (exists(root, 'prisma/schema.prisma')) signals.push('prisma');
  if (exists(root, 'drizzle.config.ts') || exists(root, 'drizzle.config.js')) signals.push('drizzle');
  const pkg = readJSON(path.join(root, 'package.json')) || {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  for (const name of [
    'express',
    'fastify',
    'hono',
    'koa',
    '@nestjs/core',
    'next',
    'django',
  ]) {
    if (deps[name]) signals.push(`dep:${name}`);
  }
  // Directory heuristics
  for (const dir of ['api', 'server', 'backend', 'services']) {
    if (exists(root, dir)) signals.push(`dir:${dir}`);
  }
  const multi = suite.multiPart || suite.systemTier === 'multi' || suite.systemTier === 'distributed';
  const serverPresent = signals.length > 0 || (multi && (exists(root, 'public') || exists(root, 'src')));
  return { serverPresent: Boolean(serverPresent && (signals.length > 0 || multi)), signals };
}

function findArchDoc(root) {
  if (exists(root, 'ARCHITECTURE.md')) return 'ARCHITECTURE.md';
  if (exists(root, 'docs/architecture.md')) return 'docs/architecture.md';
  return null;
}

function ormFrameworks(root) {
  const pkg = readJSON(path.join(root, 'package.json')) || {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const found = [];
  const map = [
    ['prisma', '@prisma/client'],
    ['prisma', 'prisma'],
    ['typeorm', 'typeorm'],
    ['sequelize', 'sequelize'],
    ['mongoose', 'mongoose'],
    ['drizzle', 'drizzle-orm'],
    ['knex', 'knex'],
  ];
  const seen = new Set();
  for (const [label, dep] of map) {
    if (deps[dep] && !seen.has(label)) {
      seen.add(label);
      found.push(label);
    }
  }
  if (exists(root, 'prisma/schema.prisma') && !seen.has('prisma')) found.push('prisma');
  return found;
}

function scanClientSecrets(root) {
  const hits = [];
  const dirs = ['public', 'client', 'src/client', 'app'];
  const re = /(sk_live_|sk_test_|AKIA[0-9A-Z]{16}|BEGIN (RSA )?PRIVATE KEY|api[_-]?key\s*[:=]\s*['"][^'"]{16,})/i;
  for (const dir of dirs) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    walk(abs, (file) => {
      if (!/\.(js|ts|tsx|jsx|mjs|cjs|html)$/i.test(file)) return;
      const text = readText(file);
      if (re.test(text)) hits.push(path.relative(root, file));
    }, 3);
  }
  return hits;
}

function walk(dir, fn, depth) {
  if (depth < 0) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      walk(p, fn, depth - 1);
    } else if (e.isFile()) fn(p);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(process.cwd(), String(args.root || '.'));
  const strict = Boolean(args.strict);
  const outPath = path.resolve(root, String(args.out || 'backend-report.json'));

  const suite = classifyProject(root);
  writeSuiteProfile(root);

  const { serverPresent, signals } = detectServer(root, suite);
  const blockers = [];
  const warnings = [];
  const checks = [];
  const archDoc = findArchDoc(root);

  if (!serverPresent) {
    pushCheck(checks, 'B-server', 'not_evaluated', { reason: 'no server signals' });
    pushCheck(checks, 'B-arch', 'not_evaluated');
    pushCheck(checks, 'B-contracts', 'not_evaluated');
    pushCheck(checks, 'B-authz', 'not_evaluated');
    pushCheck(checks, 'B-orm', 'not_evaluated');
    pushCheck(checks, 'B-secrets', 'not_evaluated');
    const report = {
      generatedBy: 'check-backend.js',
      generatedAt: new Date().toISOString(),
      root,
      serverPresent: false,
      architectureDoc: archDoc,
      signals,
      verdict: 'SHIP',
      blockers,
      warnings,
      checks,
      layerNote: 'No server detected — backend checks not evaluated.',
    };
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
    console.log(`\nWrote ${outPath}`);
    console.log('verdict: SHIP (no server)');
    return;
  }

  pushCheck(checks, 'B-server', 'pass', { signals });

  // Architecture required when server + multi-part / app-tier
  const needsArch = suite.multiPart || suite.appTier || suite.systemTier === 'multi';
  if (needsArch && !archDoc) {
    blockers.push({
      id: 'B-arch-doc',
      message: 'Server present without ARCHITECTURE.md',
      fixHint: 'Run systems-architecture; document trust boundary and contracts',
    });
    pushCheck(checks, 'B-arch', 'fail', { required: true });
  } else if (!archDoc) {
    warnings.push({
      id: 'B-arch-optional',
      message: 'Server signals without ARCHITECTURE.md',
    });
    pushCheck(checks, 'B-arch', 'not_evaluated', { reason: 'doc optional for non-multi' });
  } else {
    pushCheck(checks, 'B-arch', 'pass', { path: archDoc });
    const text = readText(path.join(root, archDoc));
    if (!hasSection(text, ['Contracts', 'Edges', 'APIs', 'API'])) {
      warnings.push({
        id: 'B-contracts-soft',
        message: `${archDoc} missing Contracts/Edges/API section`,
      });
      pushCheck(checks, 'B-contracts', 'fail');
    } else {
      pushCheck(checks, 'B-contracts', 'pass');
    }
    const authOk =
      hasSection(text, ['Trust boundary', 'Trust', 'Auth', 'Authorization', 'Authz']) ||
      /authz|authorization|who may|trusted side/i.test(text);
    if (!authOk) {
      warnings.push({
        id: 'B-authz-soft',
        message: `${archDoc} lacks authz/trust language for write paths`,
      });
      pushCheck(checks, 'B-authz', 'fail');
    } else {
      pushCheck(checks, 'B-authz', 'pass');
    }
  }

  if (!checks.some((c) => c.id === 'B-contracts')) {
    pushCheck(checks, 'B-contracts', 'not_evaluated', { reason: 'no architecture doc' });
  }
  if (!checks.some((c) => c.id === 'B-authz')) {
    pushCheck(checks, 'B-authz', 'not_evaluated', { reason: 'no architecture doc' });
  }

  const orms = ormFrameworks(root);
  if (orms.length > 1) {
    blockers.push({
      id: 'B-dual-orm',
      message: `Multiple persistence stacks: ${orms.join(', ')}`,
      fixHint: 'Pick one data access stack; update ARCHITECTURE.md',
    });
    pushCheck(checks, 'B-orm', 'fail', { orms });
  } else {
    pushCheck(checks, 'B-orm', 'pass', { orms });
  }

  const secretHits = scanClientSecrets(root);
  if (secretHits.length) {
    blockers.push({
      id: 'B-client-secret',
      message: `Possible secret material in client path: ${secretHits.slice(0, 3).join(', ')}`,
      fixHint: 'Keep secrets on the trusted side',
    });
    pushCheck(checks, 'B-secrets', 'fail', { files: secretHits });
  } else {
    pushCheck(checks, 'B-secrets', 'pass');
  }

  if (needsArch && !exists(root, 'PRODUCT.md') && !exists(root, 'product-brief.md')) {
    warnings.push({
      id: 'B-product',
      message: 'Server/app without PRODUCT.md — product-acceptance will BLOCK ship',
    });
  }

  let verdict = 'SHIP';
  if (blockers.length) verdict = 'BLOCK';
  else if (warnings.length) verdict = 'CONDITIONAL';

  const report = {
    generatedBy: 'check-backend.js',
    generatedAt: new Date().toISOString(),
    root,
    serverPresent: true,
    architectureDoc: archDoc,
    signals,
    verdict,
    blockers,
    warnings,
    checks,
    layerNote:
      'Verifies measurable backend properties (arch doc, contracts/authz sections, single ORM, no client secrets). Does not judge API design quality.',
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`\nWrote ${outPath}`);
  console.log(`verdict: ${verdict}  serverPresent: true`);
  if (blockers.length) {
    console.log('blockers:');
    blockers.forEach((b) => console.log(`  - ${b.id}: ${b.message}`));
  }
  if (warnings.length) {
    console.log('warnings:');
    warnings.forEach((w) => console.log(`  - ${w.id}: ${w.message}`));
  }
  console.log('');

  if (strict && blockers.length) process.exit(1);
}

main();
