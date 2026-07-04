#!/usr/bin/env node
/**
 * Aggregate deterministic specialist results into SHIP / CONDITIONAL / BLOCK verdict.
 *
 * Usage:
 *   node design-critique.js --root .
 *   node design-critique.js --root . --ui-check-report ui-check-report.json
 *
 * Writes design-critique-report.json. Exit 1 on BLOCK.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { findSkillRoot } = require('./lib-skill-root.cjs');
const { loadProjectContext } = require('./lib-context.cjs');

function parseArgs(argv) {
  const out = { root: process.cwd(), out: 'design-critique-report.json' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') out.root = path.resolve(argv[++i]);
    else if (argv[i] === '--ui-check-report') out.uiCheck = path.resolve(argv[++i]);
    else if (argv[i] === '--out') out.out = argv[++i];
  }
  return out;
}

function loadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const uiCheck = args.uiCheck
    ? loadJson(args.uiCheck)
    : loadJson(path.join(args.root, 'ui-check-report.json'))
      || loadJson(path.join(args.root, 'self-check-report.json'));

  const specialists = [];
  const blockers = [];
  const warnings = [];

  const ctx = loadProjectContext(args.root);
  const hasDirection = ctx.hasDirection;
  const hasBrief = ctx.hasBrief;
  const needsDirection = ctx.scopeTier === 'page' || ctx.scopeTier === 'app';

  specialists.push({
    id: 'intent',
    pass: !needsDirection || hasDirection,
    notes: !needsDirection
      ? `scope=${ctx.scopeTier} — design-direction optional`
      : hasDirection
        ? (hasBrief ? 'design-direction.md + product-brief.md present' : 'design-direction.md present')
        : 'Missing design-direction.md — Phase 2.5 not locked',
  });
  if (needsDirection && !hasDirection) blockers.push('missing-design-direction');

  if (uiCheck) {
    specialists.push({
      id: 'color',
      pass: uiCheck.contrast?.pass !== false,
      notes: uiCheck.contrast?.pass ? `${uiCheck.contrast.pairs || 0} contrast pairs pass` : 'Contrast gate failed',
    });
    if (!uiCheck.contrast?.pass) blockers.push('contrast');

    const generic = uiCheck.genericScore;
    specialists.push({
      id: 'originality',
      pass: generic === null || generic <= 2,
      notes: generic === null ? 'generic score not run' : `generic score ${generic} (max 2)`,
    });
    if (generic !== null && generic > 2) blockers.push('generic-score');

    specialists.push({
      id: 'layout',
      pass: !uiCheck.layout || uiCheck.layout.skipped || uiCheck.layout.pass,
      notes: uiCheck.layout?.skipped ? 'layout skipped' : uiCheck.layout?.pass ? 'layout pass' : 'layout fail',
    });
    if (uiCheck.layout && !uiCheck.layout.skipped && !uiCheck.layout.pass) blockers.push('layout');

    specialists.push({
      id: 'interaction',
      pass: !uiCheck.smoke || uiCheck.smoke.skipped || uiCheck.smoke.pass,
      notes: uiCheck.smoke?.skipped ? 'smoke skipped' : uiCheck.smoke?.pass ? 'smoke pass' : 'smoke fail',
    });
    if (uiCheck.smoke && !uiCheck.smoke.skipped && !uiCheck.smoke.pass) blockers.push('smoke');

    specialists.push({
      id: 'a11y-axe',
      pass: !uiCheck.axe || uiCheck.axe.skipped || uiCheck.axe.pass,
      notes: uiCheck.axe?.skipped ? 'axe skipped' : uiCheck.axe?.pass ? 'axe pass' : 'axe serious violations',
    });
    if (uiCheck.axe && !uiCheck.axe.skipped && !uiCheck.axe.pass) blockers.push('axe');

    if (uiCheck.auditFindings > 0) {
      warnings.push(`${uiCheck.auditFindings} audit-ui finding(s)`);
    }
    if (uiCheck.failures?.length) {
      for (const f of uiCheck.failures) {
        if (!blockers.includes(f)) blockers.push(f);
      }
    }
  } else {
    warnings.push('No ui-check-report.json — run ci-check.js first for full critique');
  }

  let verdict = 'SHIP';
  if (blockers.length) verdict = 'BLOCK';
  else if (warnings.length) verdict = 'CONDITIONAL';

  const report = {
    generatedAt: new Date().toISOString(),
    root: args.root,
    verdict,
    specialists,
    blockers,
    warnings,
    agentPrompts: [
      '5-second test: what is this page and what action is obvious?',
      'Generic test: name three AI-template tells; how does Phase 2.5 fix them?',
      'Hierarchy test: three text levels at arm\'s length?',
    ],
  };

  const outPath = path.resolve(args.root, args.out);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

  console.log(`\ndesign-critique: ${verdict}`);
  for (const s of specialists) {
    console.log(`  ${s.pass ? 'PASS' : 'FAIL'} ${s.id}: ${s.notes}`);
  }
  if (blockers.length) console.log(`  blockers: ${blockers.join(', ')}`);
  if (warnings.length) console.log(`  warnings: ${warnings.join('; ')}`);
  console.log(`\nWrote ${outPath}\n`);

  process.exit(verdict === 'BLOCK' ? 1 : 0);
}

main();
