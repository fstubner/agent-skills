#!/usr/bin/env node
// Deterministic architecture gates (properties + required sections).
// Exit 1 on BLOCK when --strict.
// Usage: node check-architecture.js [--root <dir>] [--strict] [--out architecture-report.json]

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

function loadProfile(root) {
  const script = path.join(__dirname, 'profile-architecture.js');
  spawnSync(process.execPath, [script, '--root', root], { stdio: 'ignore' });
  return readJSON(path.join(root, 'architecture-profile.json')) || {};
}

function hasSection(text, names) {
  return names.some((n) => new RegExp(`^##\\s*${n}\\b`, 'im').test(text));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(process.cwd(), String(args.root || '.'));
  const strict = Boolean(args.strict);
  const outPath = path.resolve(root, String(args.out || 'architecture-report.json'));

  const profile = loadProfile(root);
  const tier = profile.systemTier || 'single';
  const multi = tier === 'multi' || tier === 'distributed';
  const blockers = [];
  const warnings = [];
  const checks = [];

  const docRel = profile.architectureDoc;
  if (multi && !docRel) {
    blockers.push({
      id: 'P-arch-doc',
      message: 'Multi/distributed system missing ARCHITECTURE.md (or docs/architecture.md)',
      fixHint: 'Copy systems-architecture/templates/ARCHITECTURE.md and fill required sections',
    });
    checks.push({ id: 'P-arch-doc', pass: false });
  } else if (!docRel) {
    warnings.push({
      id: 'P-arch-doc-optional',
      message: 'No ARCHITECTURE.md (ok for single-tier unless integrations grow)',
    });
    checks.push({ id: 'P-arch-doc', pass: true, optional: true });
  } else {
    checks.push({ id: 'P-arch-doc', pass: true, path: docRel });
    const text = readText(path.join(root, docRel));
    const required = [
      ['Context', ['Context']],
      ['Parts', ['Parts', 'Components']],
      ['Trust boundary', ['Trust boundary', 'Trust']],
      ['Data ownership', ['Data ownership', 'Data']],
      ['Failure modes', ['Failure modes', 'Failures']],
    ];
    for (const [label, names] of required) {
      const ok = hasSection(text, names);
      checks.push({ id: `P-section-${label}`, pass: ok });
      if (!ok && multi) {
        blockers.push({
          id: `P-thin-${label.replace(/\s+/g, '-').toLowerCase()}`,
          message: `${docRel} missing clear ## ${label}`,
          fixHint: `Add section to ${docRel} (see templates/ARCHITECTURE.md)`,
        });
      }
    }
    if (!hasSection(text, ['Contracts', 'Edges', 'APIs'])) {
      warnings.push({
        id: 'P-contracts-soft',
        message: `${docRel} has no Contracts/Edges section`,
      });
    }
    if (!hasSection(text, ['Anti-goals', 'Non-goals'])) {
      warnings.push({
        id: 'P-antigoals-soft',
        message: `${docRel} has no architecture anti-goals`,
      });
    }
  }

  if (multi && !profile.hasProductContract) {
    blockers.push({
      id: 'P-product',
      message: 'Multi-part system without PRODUCT.md / product-brief.md',
      fixHint: 'Write product contract before freezing architecture',
    });
  }

  for (const s of profile.smells || []) {
    if (s.id === 'client-sk-key' || s.id === 'client-aws-key' || s.id === 'client-private-pem' || s.id === 'client-hardcoded-apikey') {
      blockers.push({
        id: 'P-trust-secret',
        message: `Possible secret/privileged material in untrusted client path: ${s.detail}`,
        fixHint: 'Move secrets to trusted side; document trust boundary',
      });
    }
    if (s.id === 'store-unclear') {
      warnings.push({
        id: 'P-store-unclear',
        message: s.detail,
      });
    }
  }

  let verdict = 'SHIP';
  if (blockers.length) verdict = 'BLOCK';
  else if (warnings.length) verdict = 'CONDITIONAL';

  const report = {
    generatedBy: 'check-architecture.js',
    generatedAt: new Date().toISOString(),
    root,
    systemTier: tier,
    architectureDoc: docRel || null,
    verdict,
    blockers,
    warnings,
    checks,
    evergreenNote:
      'Gates enforce properties (doc presence, sections, trust smells). They do not require a vendor stack.',
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
