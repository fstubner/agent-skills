#!/usr/bin/env node
// Deterministic product-acceptance precheck. Exit 1 on BLOCK when --strict.
// Usage: node accept-check.js [--root <dir>] [--strict] [--out product-acceptance-report.json]

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

function loadProduct(root) {
  if (exists(root, 'PRODUCT.md')) {
    return { path: 'PRODUCT.md', text: readText(path.join(root, 'PRODUCT.md')) };
  }
  if (exists(root, 'product-brief.md')) {
    return { path: 'product-brief.md', text: readText(path.join(root, 'product-brief.md')) };
  }
  return null;
}

function hasSection(text, names) {
  return names.some((n) => new RegExp(`^##\\s*${n}\\b`, 'im').test(text));
}

function inferAppTier(root) {
  const profile = readJSON(path.join(root, 'stack-profile.json')) || readJSON(path.join(root, 'design-profile.json'));
  if (profile?.scopeTier === 'app') return true;
  if (exists(root, 'public/app.js') || exists(root, 'server.js')) return true;
  if (exists(root, 'public/index.html') && /\.app-shell|data-tab=/i.test(readText(path.join(root, 'public/index.html')))) {
    return true;
  }
  return false;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(process.cwd(), String(args.root || '.'));
  const strict = Boolean(args.strict);
  const outPath = path.resolve(root, String(args.out || 'product-acceptance-report.json'));

  const blockers = [];
  const warnings = [];
  const checks = [];

  const appTier = inferAppTier(root);
  const product = loadProduct(root);

  if (!product) {
    const item = {
      id: 'A-contract-missing',
      severity: 'BLOCK',
      message: 'No PRODUCT.md or product-brief.md',
      fixHint: 'Copy product-acceptance/templates/PRODUCT.md and fill required sections',
    };
    if (appTier) blockers.push(item);
    else warnings.push({ ...item, severity: 'WARN', message: item.message + ' (non-app tier)' });
    checks.push({ id: item.id, pass: false });
  } else {
    checks.push({ id: 'A-contract-present', pass: true, path: product.path });
    const text = product.text;
    const need = [
      ['Users', ['Users', 'Audience', 'Who']],
      ['Purpose', ['Purpose', 'Job', 'JTBD']],
      ['Success', ['Success', 'Metric', 'Outcome']],
    ];
    for (const [label, names] of need) {
      const ok = hasSection(text, names) || new RegExp(label, 'i').test(text);
      checks.push({ id: `A-section-${label.toLowerCase()}`, pass: ok });
      if (!ok && appTier) {
        blockers.push({
          id: `A-thin-${label.toLowerCase()}`,
          severity: 'BLOCK',
          message: `Product contract missing clear ${label}`,
          fixHint: `Add ## ${label} to ${product.path}`,
        });
      }
    }
    if (!hasSection(text, ['MVP', 'Scope', 'In scope']) && appTier) {
      warnings.push({
        id: 'A-mvp-soft',
        severity: 'WARN',
        message: 'No MVP / scope section — acceptance criteria may be ambiguous',
      });
    }
    if (!hasSection(text, ['Anti-goals', 'Out of scope', 'Non-goals']) && appTier) {
      warnings.push({
        id: 'A-antigoals-soft',
        severity: 'WARN',
        message: 'No anti-goals section',
      });
    }
  }

  const eng = readJSON(path.join(root, 'eng-structure-report.json'));
  if (appTier) {
    if (!eng) {
      warnings.push({
        id: 'D-eng-missing',
        severity: 'WARN',
        message: 'No eng-structure-report.json — run frontend-engineering check-structure.js',
      });
    } else if (eng.verdict === 'BLOCK') {
      blockers.push({
        id: 'D-eng-block',
        severity: 'BLOCK',
        message: 'Engineering structure verdict is BLOCK',
        fixHint: 'Resolve eng-structure-report blockers before product SHIP',
      });
    }
    checks.push({ id: 'D-eng', pass: Boolean(eng) && eng.verdict !== 'BLOCK' });
  }

  const design = readJSON(path.join(root, 'design-critique-report.json'));
  if (design?.verdict === 'BLOCK') {
    blockers.push({
      id: 'D-design-block',
      severity: 'BLOCK',
      message: 'design-critique-report verdict is BLOCK',
      fixHint: 'Fix design blockers or do not claim UI complete',
    });
  }

  if (appTier && !exists(root, 'stack-decision.md')) {
    const stackProfile = readJSON(path.join(root, 'stack-profile.json'));
    if (!stackProfile || stackProfile.needsStackInterview || /unknown|vanilla/i.test(String(stackProfile.framework || ''))) {
      warnings.push({
        id: 'D-stack-decision',
        severity: 'WARN',
        message: 'No stack-decision.md — greenfield/unknown stacks should be locked by frontend-engineering',
      });
    }
  }

  const arch = readJSON(path.join(root, 'architecture-report.json'));
  const archProfile = readJSON(path.join(root, 'architecture-profile.json'));
  const multiArch =
    arch?.systemTier === 'multi' ||
    arch?.systemTier === 'distributed' ||
    archProfile?.systemTier === 'multi' ||
    archProfile?.systemTier === 'distributed' ||
    (exists(root, 'server.js') && (exists(root, 'public/index.html') || exists(root, 'index.html')));
  if (multiArch || appTier) {
    if (arch?.verdict === 'BLOCK') {
      blockers.push({
        id: 'D-arch-block',
        severity: 'BLOCK',
        message: 'architecture-report verdict is BLOCK',
        fixHint: 'Resolve systems-architecture check-architecture.js blockers (boundaries/trust/doc)',
      });
    } else if (!arch && multiArch) {
      warnings.push({
        id: 'D-arch-missing',
        severity: 'WARN',
        message: 'No architecture-report.json — run systems-architecture check-architecture.js on multi-part systems',
      });
    }
    checks.push({
      id: 'D-arch',
      pass: !arch || arch.verdict !== 'BLOCK',
    });
  }

  warnings.push({
    id: 'E-self-grade',
    severity: 'WARN',
    message: 'Ensure acceptor is not the same unbroken builder turn (builder ≠ acceptor)',
  });

  let verdict = 'SHIP';
  if (blockers.length) verdict = 'BLOCK';
  else if (warnings.length) verdict = 'CONDITIONAL';

  const report = {
    generatedBy: 'accept-check.js',
    generatedAt: new Date().toISOString(),
    root,
    appTier,
    productContract: product ? product.path : null,
    verdict,
    blockers,
    warnings,
    checks,
    agentPrompts: [
      'State the primary job in one sentence from the contract.',
      'List happy-path steps and mark each evidenced or missing.',
      'Name one demo-ware risk (fake data, stub controls, missing empty states).',
      'Confirm this acceptance pass is not the implementing turn.',
    ],
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`\nWrote ${outPath}`);
  console.log(`verdict: ${verdict}`);
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
