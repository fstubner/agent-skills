#!/usr/bin/env node
// Product-acceptance verification (evidence, not design judgment).
// Exit 1 on BLOCK when --strict.
//
// Usage:
//   node accept-check.js [--root <dir>] [--strict]
//     [--out product-acceptance-report.json]
//     [--acceptor-context separate|same|unknown]
//
// Check status values: pass | fail | not_evaluated
// Notes are informational and do NOT affect SHIP/CONDITIONAL/BLOCK.

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

function pushCheck(checks, id, status, extra = {}) {
  checks.push({ id, status, ...extra });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(process.cwd(), String(args.root || '.'));
  const strict = Boolean(args.strict);
  const outPath = path.resolve(root, String(args.out || 'product-acceptance-report.json'));
  const acceptorContext = String(args['acceptor-context'] || 'unknown'); // separate | same | unknown

  const blockers = [];
  const warnings = [];
  const notes = [];
  const checks = [];

  writeSuiteProfile(root);
  const suite = classifyProject(root);
  const appTier = suite.appTier;
  const multiPart = suite.multiPart;
  const product = loadProduct(root);

  if (!product) {
    const item = {
      id: 'A-contract-missing',
      severity: 'BLOCK',
      message: 'No PRODUCT.md or product-brief.md',
      fixHint: 'Copy product-acceptance/templates/PRODUCT.md and fill required sections',
    };
    if (appTier) blockers.push(item);
    else warnings.push({ ...item, severity: 'WARN', message: `${item.message} (non-app tier)` });
    pushCheck(checks, 'A-contract', 'fail');
  } else {
    pushCheck(checks, 'A-contract', 'pass', { path: product.path });
    const text = product.text;
    const need = [
      ['Users', ['Users', 'Audience', 'Who']],
      ['Purpose', ['Purpose', 'Job', 'JTBD']],
      ['Success', ['Success', 'Metric', 'Outcome']],
    ];
    for (const [label, names] of need) {
      const ok = hasSection(text, names) || new RegExp(label, 'i').test(text);
      pushCheck(checks, `A-section-${label.toLowerCase()}`, ok ? 'pass' : 'fail');
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
      pushCheck(checks, 'D-eng', 'not_evaluated', { reason: 'missing eng-structure-report.json' });
    } else if (eng.verdict === 'BLOCK') {
      blockers.push({
        id: 'D-eng-block',
        severity: 'BLOCK',
        message: 'Engineering structure verdict is BLOCK',
        fixHint: 'Resolve eng-structure-report blockers before product SHIP',
      });
      pushCheck(checks, 'D-eng', 'fail', { verdict: eng.verdict });
    } else {
      pushCheck(checks, 'D-eng', 'pass', { verdict: eng.verdict });
    }
  } else {
    pushCheck(checks, 'D-eng', 'not_evaluated', { reason: 'not app-tier' });
  }

  const design = readJSON(path.join(root, 'design-critique-report.json'));
  if (!design) {
    pushCheck(checks, 'D-design', 'not_evaluated', { reason: 'missing design-critique-report.json' });
  } else if (design.verdict === 'BLOCK') {
    blockers.push({
      id: 'D-design-block',
      severity: 'BLOCK',
      message: 'design-critique-report verdict is BLOCK',
      fixHint: 'Fix design blockers or do not claim UI complete',
    });
    pushCheck(checks, 'D-design', 'fail', { verdict: design.verdict });
  } else {
    pushCheck(checks, 'D-design', 'pass', { verdict: design.verdict });
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
  if (multiPart || appTier) {
    if (!arch) {
      if (multiPart) {
        warnings.push({
          id: 'D-arch-missing',
          severity: 'WARN',
          message: 'No architecture-report.json — run systems-architecture check-architecture.js on multi-part systems',
        });
        pushCheck(checks, 'D-arch', 'not_evaluated', { reason: 'missing architecture-report.json', required: multiPart });
      } else {
        pushCheck(checks, 'D-arch', 'not_evaluated', { reason: 'no architecture report; multiPart=false' });
      }
    } else if (arch.verdict === 'BLOCK') {
      blockers.push({
        id: 'D-arch-block',
        severity: 'BLOCK',
        message: 'architecture-report verdict is BLOCK',
        fixHint: 'Resolve systems-architecture check-architecture.js blockers (boundaries/trust/doc)',
      });
      pushCheck(checks, 'D-arch', 'fail', { verdict: arch.verdict });
    } else {
      pushCheck(checks, 'D-arch', 'pass', { verdict: arch.verdict });
    }
  } else {
    pushCheck(checks, 'D-arch', 'not_evaluated', { reason: 'not multi-part / app-tier' });
  }

  // Builder ≠ acceptor: only affect verdict when context is known
  if (acceptorContext === 'same') {
    blockers.push({
      id: 'E-self-grade',
      severity: 'BLOCK',
      message: 'Acceptor context is same as builder turn (builder ≠ acceptor)',
      fixHint: 'Run acceptance in a separate turn/subagent with --acceptor-context separate',
    });
    pushCheck(checks, 'E-acceptor', 'fail', { acceptorContext });
  } else if (acceptorContext === 'separate') {
    pushCheck(checks, 'E-acceptor', 'pass', { acceptorContext });
  } else {
    notes.push({
      id: 'E-self-grade',
      message:
        'Builder ≠ acceptor is a process rule. Pass --acceptor-context separate|same when known. Unknown does not downgrade SHIP.',
    });
    pushCheck(checks, 'E-acceptor', 'not_evaluated', { acceptorContext: 'unknown' });
  }

  let verdict = 'SHIP';
  if (blockers.length) verdict = 'BLOCK';
  else if (warnings.length) verdict = 'CONDITIONAL';

  const report = {
    generatedBy: 'accept-check.js',
    generatedAt: new Date().toISOString(),
    root,
    suiteProfile: {
      scopeTier: suite.scopeTier,
      systemTier: suite.systemTier,
      appTier,
      multiPart,
      source: suite.source,
    },
    acceptorContext,
    productContract: product ? product.path : null,
    verdict,
    blockers,
    warnings,
    notes,
    checks,
    agentPrompts: [
      'State the primary job in one sentence from the contract.',
      'List happy-path steps and mark each evidenced or missing.',
      'Name one demo-ware risk (fake data, stub controls, missing empty states).',
      'Confirm this acceptance pass is not the implementing turn (use --acceptor-context separate).',
    ],
    layerNote: 'This script verifies measurable evidence. Judgment remains in skills/references.',
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`\nWrote ${outPath}`);
  console.log(`verdict: ${verdict}  appTier: ${appTier}  multiPart: ${multiPart}`);
  if (blockers.length) {
    console.log('blockers:');
    blockers.forEach((b) => console.log(`  - ${b.id}: ${b.message}`));
  }
  if (warnings.length) {
    console.log('warnings:');
    warnings.forEach((w) => console.log(`  - ${w.id}: ${w.message}`));
  }
  if (notes.length) {
    console.log('notes:');
    notes.forEach((n) => console.log(`  - ${n.id}: ${n.message}`));
  }
  console.log('');

  if (strict && blockers.length) process.exit(1);
}

main();
