#!/usr/bin/env node
// Profile system shape + architecture smells. Writes architecture-profile.json.
// Evergreen: detects properties (parts, trust risks), not a preferred vendor stack.
// Usage: node profile-architecture.js [--root <dir>] [--out architecture-profile.json]

'use strict';

const fs = require('fs');
const path = require('path');

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

function walkFiles(root, pred, max = 6000) {
  const out = [];
  const stack = [root];
  let seen = 0;
  const skip = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage',
    '.svelte-kit', 'out', '.turbo', '.cache',
  ]);
  while (stack.length && seen < max) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!skip.has(e.name) && !e.name.startsWith('.')) stack.push(full);
      } else {
        seen++;
        if (pred(full, e.name)) out.push(full);
      }
    }
  }
  return out;
}

function findArchitectureDoc(root) {
  const candidates = [
    'ARCHITECTURE.md',
    'architecture.md',
    'docs/ARCHITECTURE.md',
    'docs/architecture.md',
  ];
  for (const c of candidates) {
    if (exists(root, c)) return c;
  }
  return null;
}

function detectParts(root, deps) {
  const parts = {
    client: false,
    service: false,
    storeFiles: false,
    workerHints: false,
    thirdPartyHints: [],
  };

  if (
    exists(root, 'index.html') ||
    exists(root, 'public/index.html') ||
    exists(root, 'src/main.tsx') ||
    exists(root, 'src/main.ts') ||
    exists(root, 'src/App.tsx') ||
    exists(root, 'app') ||
    deps['react'] ||
    deps['vue'] ||
    deps['svelte'] ||
    deps['next'] ||
    deps['astro']
  ) {
    parts.client = true;
  }

  const serviceFiles = [
    'server.js', 'server.ts', 'api/index.js', 'api/index.ts',
    'src/server.js', 'src/server.ts', 'backend/server.js',
  ];
  if (serviceFiles.some((f) => exists(root, f))) parts.service = true;
  if (deps['express'] || deps['fastify'] || deps['hono'] || deps['@nestjs/core'] || deps['koa']) {
    parts.service = true;
  }
  if (exists(root, 'vercel.json') && (exists(root, 'api') || exists(root, 'app/api'))) {
    parts.service = true;
  }

  if (
    exists(root, 'db.json') ||
    exists(root, 'database.js') ||
    exists(root, 'prisma/schema.prisma') ||
    deps['pg'] ||
    deps['mysql2'] ||
    deps['mongodb'] ||
    deps['better-sqlite3'] ||
    deps['sqlite3'] ||
    deps['@supabase/supabase-js']
  ) {
    parts.storeFiles = true;
  }

  if (
    deps['bull'] ||
    deps['bullmq'] ||
    deps['sqs'] ||
    /worker|queue/i.test(JSON.stringify(Object.keys(deps)))
  ) {
    parts.workerHints = true;
  }

  const pkgBlob = JSON.stringify(deps);
  const thirdPartyLibs = [
    ['openai', 'openai'],
    ['@google/generative-ai', 'google-generative-ai'],
    ['stripe', 'stripe'],
    ['twilio', 'twilio'],
    ['@sendgrid/mail', 'sendgrid'],
    ['aws-sdk', 'aws-sdk'],
    ['@aws-sdk/client-s3', 'aws-s3'],
  ];
  for (const [dep, label] of thirdPartyLibs) {
    if (deps[dep]) parts.thirdPartyHints.push(label);
  }

  // Heuristic: client calling external HTTPS APIs in source (not a vendor preference)
  const clientLike = walkFiles(
    root,
    (f, name) =>
      /\.(js|ts|tsx|jsx)$/i.test(name) &&
      !/node_modules/.test(f) &&
      (/public[/\\]/.test(f) || /src[/\\]/.test(f)),
  ).slice(0, 80);
  let clientFetchExternal = false;
  for (const f of clientLike) {
    const t = readText(f);
    if (/https?:\/\/(?!localhost|127\.0\.0\.1)/i.test(t) && /fetch\(|axios\.|XMLHttpRequest/i.test(t)) {
      clientFetchExternal = true;
      break;
    }
  }
  if (clientFetchExternal && !parts.thirdPartyHints.includes('client-external-http')) {
    parts.thirdPartyHints.push('client-external-http');
  }

  return parts;
}

function detectSecretSmells(root) {
  const smells = [];
  const clientFiles = walkFiles(
    root,
    (f, name) =>
      /\.(js|ts|tsx|jsx|html)$/i.test(name) &&
      (/public[/\\]/.test(f) || /src[/\\]/.test(f) || /app[/\\]/.test(f)),
  ).slice(0, 120);

  const patterns = [
    { id: 'client-sk-key', re: /sk-[a-zA-Z0-9]{10,}/ },
    { id: 'client-aws-key', re: /AKIA[0-9A-Z]{12,}/ },
    { id: 'client-private-pem', re: /BEGIN (RSA |EC )?PRIVATE KEY/ },
  ];

  for (const f of clientFiles) {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    // skip obvious server-only paths
    if (/(^|\/)(server|api|backend)(\/|$)/i.test(rel) && !/public\//i.test(rel)) continue;
    const t = readText(f);
    for (const p of patterns) {
      if (p.re.test(t)) {
        smells.push({ id: p.id, detail: rel });
      }
    }
    // Hardcoded apiKey assignments in client bundles (property: secret-like in untrusted code)
    if (
      /public\//i.test(rel) &&
      /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i.test(t) &&
      !/process\.env|import\.meta\.env/i.test(t)
    ) {
      smells.push({ id: 'client-hardcoded-apikey', detail: rel });
    }
  }
  return smells;
}

function classifyTier(parts) {
  const third = parts.thirdPartyHints.length > 0;
  const multi = (parts.client && parts.service) || (parts.client && third) || (parts.service && third);
  if (!multi && !parts.workerHints) return 'single';
  // "distributed" = strong signal of multiple async/deploy concerns without claiming vendor topology
  if (parts.workerHints && parts.service && parts.client) return 'distributed';
  return 'multi';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(process.cwd(), String(args.root || '.'));
  const outPath = path.resolve(root, String(args.out || 'architecture-profile.json'));

  const pkg = readJSON(path.join(root, 'package.json')) || {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const parts = detectParts(root, deps);
  const architectureDoc = findArchitectureDoc(root);
  const hasProduct =
    exists(root, 'PRODUCT.md') || exists(root, 'product-brief.md');
  const systemTier = classifyTier(parts);
  const secretSmells = detectSecretSmells(root);

  const smells = [...secretSmells];
  if ((systemTier === 'multi' || systemTier === 'distributed') && !architectureDoc) {
    smells.push({ id: 'arch-doc-missing', detail: 'multi/distributed without ARCHITECTURE.md' });
  }
  if (!hasProduct && (systemTier === 'multi' || systemTier === 'distributed')) {
    smells.push({ id: 'product-missing', detail: 'multi-part system without PRODUCT.md / product-brief.md' });
  }
  if (parts.client && parts.service && parts.storeFiles === false && systemTier !== 'single') {
    // not always a defect (stateless proxy) — warn via smell id for checklist
    smells.push({ id: 'store-unclear', detail: 'service+client detected; no obvious persistence layer in deps/files' });
  }

  const needsArchitectureDoc =
    (systemTier === 'multi' || systemTier === 'distributed') && !architectureDoc;

  const profile = {
    generatedBy: 'profile-architecture.js',
    root,
    systemTier,
    parts: {
      client: parts.client,
      service: parts.service,
      storeDetected: parts.storeFiles,
      workerHints: parts.workerHints,
      thirdPartyHints: parts.thirdPartyHints,
    },
    architectureDoc,
    hasProductContract: hasProduct,
    needsArchitectureDoc,
    smells,
    guidance: [
      needsArchitectureDoc
        ? 'Write ARCHITECTURE.md from templates/ARCHITECTURE.md using references/boundaries.md (properties, not vendor defaults).'
        : 'Extend existing ARCHITECTURE.md; do not invent a parallel system.',
      'Trust boundary: privileged secrets must not live in untrusted client code.',
      'Run check-architecture.js --strict before claiming system-ready.',
    ],
  };

  fs.writeFileSync(outPath, JSON.stringify(profile, null, 2) + '\n');
  console.log(`\nWrote ${outPath}`);
  console.log(`systemTier: ${systemTier}`);
  console.log(`archDoc:    ${architectureDoc || '(missing)'}`);
  console.log(`needsDoc:   ${needsArchitectureDoc}`);
  console.log(`smells:     ${smells.length ? smells.map((s) => s.id).join(', ') : '(none)'}`);
  console.log('');
}

main();
