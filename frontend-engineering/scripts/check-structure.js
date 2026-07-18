#!/usr/bin/env node
// Deterministic structure gates. Exit 1 on BLOCK when --strict.
// Usage: node check-structure.js [--root <dir>] [--strict] [--out eng-structure-report.json]

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

function loadOrBuildProfile(root) {
  const cached = readJSON(path.join(root, 'stack-profile.json'));
  if (cached && cached.generatedBy === 'profile-stack.js') return cached;
  // Lightweight inline: require sibling script via spawn-less re-read by running logic import
  const { spawnSync } = require('child_process');
  const script = path.join(__dirname, 'profile-stack.js');
  spawnSync(process.execPath, [script, '--root', root], { stdio: 'ignore' });
  return readJSON(path.join(root, 'stack-profile.json')) || {};
}

function isThrowaway(root) {
  const text = readText(path.join(root, 'stack-decision.md'));
  return /shape:\s*`?throwaway-demo`?/i.test(text) || /\*\*Shape:\*\*\s*`?throwaway-demo`?/i.test(text);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(process.cwd(), String(args.root || '.'));
  const strict = Boolean(args.strict);
  const outPath = path.resolve(root, String(args.out || 'eng-structure-report.json'));

  const profile = loadOrBuildProfile(root);
  const scopeTier = profile.scopeTier || 'component';
  const throwaway = isThrowaway(root);
  const blockers = [];
  const warnings = [];

  const smells = profile.smells || [];
  for (const s of smells) {
    if (s.id === 'dual-icons') blockers.push({ id: 'P-dual-icons', message: `Multiple icon systems: ${s.detail}` });
    if (s.id === 'dual-framework') blockers.push({ id: 'P-dual-framework', message: `Multiple UI runtimes: ${s.detail}` });
    if (s.id === 'stack-undecided') {
      blockers.push({ id: 'P-unknown-stack', message: 'Unknown/vanilla stack without stack-decision.md' });
    }
    if (s.id === 'no-component-surface' && scopeTier === 'app' && !throwaway) {
      blockers.push({ id: 'P-components-dir', message: s.detail });
    }
    if (s.id === 'monolith-files') {
      const item = { id: 'P-monolith', message: `Large source files: ${s.detail}` };
      if (throwaway || scopeTier === 'component') warnings.push(item);
      else blockers.push(item);
    }
  }

  if ((scopeTier === 'app' || scopeTier === 'page') && !profile.hasStackDecision && /unknown|vanilla/i.test(String(profile.framework || ''))) {
    if (!blockers.some((b) => b.id === 'P-unknown-stack')) {
      blockers.push({ id: 'P-unknown-stack', message: 'Lock stack via stack-decision.md before polish' });
    }
  }

  // Soft: PRODUCT missing is acceptance's hard gate; warn here for app tier
  if (scopeTier === 'app' && !profile.hasProductContract) {
    warnings.push({ id: 'W-no-product', message: 'No PRODUCT.md / product-brief.md — product-acceptance will BLOCK ship' });
  }

  let verdict = 'SHIP';
  if (blockers.length) verdict = 'BLOCK';
  else if (warnings.length) verdict = 'CONDITIONAL';

  const report = {
    generatedBy: 'check-structure.js',
    generatedAt: new Date().toISOString(),
    root,
    scopeTier,
    throwaway,
    verdict,
    blockers,
    warnings,
    profileSummary: {
      framework: profile.framework,
      needsStackInterview: profile.needsStackInterview,
      smells: smells.map((s) => s.id),
    },
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
