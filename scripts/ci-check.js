#!/usr/bin/env node
/**
 * CI validation orchestrator — run in project root or CI pipeline.
 *
 * Usage:
 *   node ci-check.js --root . [--skill-root path]
 *   node ci-check.js --root . --base-url http://localhost:3000 --strict
 *
 * Release gates (see references/verification.md):
 *   BLOCK: contrast, layout, smoke, axe, generic>2, missing design-direction, audit-diff
 *   WARN:  audit-ui findings (use --fail-warnings to block)
 *
 * Writes ui-check-report.json. Run design-critique.js after for SHIP/BLOCK verdict.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { findSkillRoot, findPlaywrightCwd } = require('./lib-skill-root.cjs');

function parseArgs(argv) {
  const out = {
    root: process.cwd(),
    out: 'ui-check-report.json',
    strict: false,
    failWarnings: false,
    layout: true,
    smoke: true,
    axe: true,
    auditDiff: false,
    requireDirectionLock: false,
    maxGenericScore: null,
    diffBase: 'main',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') out.root = path.resolve(argv[++i]);
    else if (a === '--skill-root') out.skillRoot = path.resolve(argv[++i]);
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--base-url') out.baseUrl = argv[++i];
    else if (a === '--config') out.config = path.resolve(argv[++i]);
    else if (a === '--strict') {
      out.strict = true;
      out.requireDirectionLock = true;
      out.maxGenericScore = 2;
      out.auditDiff = true;
    } else if (a === '--fail-warnings') out.failWarnings = true;
    else if (a === '--require-direction-lock') out.requireDirectionLock = true;
    else if (a === '--max-generic') out.maxGenericScore = Number(argv[++i]);
    else if (a === '--skip-layout') out.layout = false;
    else if (a === '--skip-smoke') out.smoke = false;
    else if (a === '--skip-axe') out.axe = false;
    else if (a === '--audit-diff') out.auditDiff = true;
    else if (a === '--diff-base') out.diffBase = argv[++i];
    else if (a === '--tokens') out.tokens = argv[++i];
  }
  return out;
}

function runNode(script, scriptArgs, cwd) {
  const r = spawnSync(process.execPath, [script, ...scriptArgs], {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function walkCssFiles(root) {
  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'artifacts', 'baseline', 'ui-guardrails']);
  const files = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.css')) files.push(p);
    }
  }
  walk(root);
  return files;
}

function findTokens(root, explicit) {
  if (explicit) return path.resolve(root, explicit);
  for (const c of ['design-tokens.json', path.join('src', 'design-tokens.json')]) {
    const p = path.resolve(root, c);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findFragileConfig(root, explicit) {
  if (explicit) return explicit;
  for (const c of [
    path.join(root, 'ui-guardrails', 'fragile-surfaces.json'),
    path.join(root, 'fragile-surfaces.json'),
  ]) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function countAuditFindings(stdout) {
  const m = stdout.match(/(\d+)\s+total finding/i);
  return m ? Number(m[1]) : 0;
}

function hasAppShellMarkup(root) {
  const exts = ['.html', '.tsx', '.jsx', '.vue'];
  const skip = new Set(['node_modules', '.git', 'dist', 'build']);
  let found = false;
  function walk(dir) {
    if (found) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (found) return;
      if (skip.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (exts.some((x) => e.name.endsWith(x))) {
        try {
          const text = fs.readFileSync(p, 'utf8');
          if (/class=["'][^"']*app-shell|className=["'][^"']*app-shell/.test(text)) {
            found = true;
          }
        } catch { /* ignore */ }
      }
    }
  }
  walk(root);
  return found;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const skillRoot = findSkillRoot(args.skillRoot);
  if (!skillRoot) {
    console.error('Cannot find skill root. Pass --skill-root or set FRONTEND_DESIGN_SKILL_ROOT.');
    process.exit(1);
  }

  const scripts = path.join(skillRoot, 'scripts');
  const configPath = findFragileConfig(args.root, args.config);
  const report = {
    generatedAt: new Date().toISOString(),
    root: args.root,
    skillRoot,
    config: configPath ? path.relative(args.root, configPath) : null,
    baseUrl: args.baseUrl || null,
    strict: args.strict,
    contrast: { pass: false, pairs: 0 },
    genericScore: null,
    auditFindings: 0,
    auditFiles: [],
    auditDiff: null,
    hasDirectionLock: fs.existsSync(path.join(args.root, 'design-direction.md')),
    hasProductBrief: fs.existsSync(path.join(args.root, 'product-brief.md')),
    hasTokens: false,
    layout: null,
    smoke: null,
    axe: null,
    verdict: 'FAIL',
    failures: [],
    warnings: [],
  };

  const tokensPath = findTokens(args.root, args.tokens);
  if (tokensPath) {
    report.hasTokens = true;
    const darkCssPath = path.join(args.root, 'tokens.dark.css');
    if (fs.existsSync(darkCssPath)) {
      const firstLine = fs.readFileSync(darkCssPath, 'utf8').split(/\r?\n/, 1)[0].trim();
      if (firstLine !== '[data-theme="dark"] {') {
        report.failures.push('tokens-dark-css');
        report.warnings.push(
          `tokens.dark.css has invalid selector (${firstLine}). Regenerate: node tokens-to-css.js design-tokens.dark.json --theme dark --out tokens.dark.css`,
        );
      }
    }
    const r = runNode(path.join(scripts, 'check-tokens-contrast.js'), [tokensPath], args.root);
    report.contrast.pass = r.code === 0;
    report.contrast.pairs = (r.stdout.match(/PASS/g) || []).length;
    report.contrast.detail = r.stdout + r.stderr;
    if (!report.contrast.pass) report.failures.push('contrast');
  } else {
    report.warnings.push('No design-tokens.json — contrast gate skipped');
    report.contrast.pass = true;
  }

  const cssFiles = walkCssFiles(args.root);
  let totalFindings = 0;
  for (const f of cssFiles) {
    const r = runNode(path.join(scripts, 'audit-ui.js'), [f], args.root);
    const n = countAuditFindings(r.stdout);
    if (n > 0) report.auditFiles.push({ file: path.relative(args.root, f), findings: n });
    totalFindings += n;
  }
  report.auditFindings = totalFindings;

  if (cssFiles[0]) {
    const genArgs = [cssFiles[0]];
    if (tokensPath) genArgs.push(tokensPath);
    genArgs.push('--root', args.root);
    const r = runNode(path.join(scripts, 'audit-generic.js'), genArgs, args.root);
    const scoreMatch = r.stdout.match(/Score:\s*(\d+)/);
    report.genericScore = scoreMatch ? Number(scoreMatch[1]) : null;
    report.genericDetail = r.stdout;
  }

  if (args.auditDiff) {
    const r = runNode(path.join(scripts, 'audit-diff.js'), ['--root', args.root, '--base', args.diffBase], args.root);
    report.auditDiff = { pass: r.code === 0, stdout: r.stdout, stderr: r.stderr };
    if (!report.auditDiff.pass) report.failures.push('audit-diff');
  }

  if (args.requireDirectionLock && hasAppShellMarkup(args.root) && !report.hasDirectionLock) {
    report.failures.push('missing-design-direction');
    report.warnings.push('Full app shell detected but design-direction.md missing (Phase 2.5)');
  }

  const maxGeneric = args.maxGenericScore ?? (args.strict ? 2 : null);
  if (maxGeneric !== null && report.genericScore !== null && report.genericScore > maxGeneric) {
    report.failures.push('generic-score');
  }

  if (args.failWarnings && report.auditFindings > 0) {
    report.failures.push('audit-warnings');
  }

  if (args.baseUrl && configPath && args.layout) {
    const layoutSurfaces = JSON.parse(fs.readFileSync(configPath, 'utf8')).surfaces?.filter((s) => s.layout) ?? [];
    if (layoutSurfaces.length) {
      const pwCwd = findPlaywrightCwd(args.root, skillRoot);
      const r = runNode(
        path.join(scripts, 'layout-check.mjs'),
        ['--config', configPath, '--base-url', args.baseUrl],
        pwCwd,
      );
      report.layout = { pass: r.code === 0, stdout: r.stdout, stderr: r.stderr };
      if (!report.layout.pass) report.failures.push('layout');
    } else {
      report.layout = { pass: true, skipped: true, reason: 'no layout surfaces in config' };
    }
  } else if (args.strict && args.layout && args.baseUrl) {
    report.warnings.push('No fragile-surfaces.json — layout gate skipped');
    report.layout = { pass: true, skipped: true };
  }

  if (args.baseUrl && configPath && args.smoke) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const smokeTests = config.smoke || [];
    if (smokeTests.length) {
      const pwCwd = findPlaywrightCwd(args.root, skillRoot);
      const smokeScript = path.join(skillRoot, 'ab-harness', 'scripts', 'smoke.mjs');
      const r = spawnSync(process.execPath, [
        smokeScript,
        '--base-url', args.baseUrl,
        '--config', configPath,
      ], { cwd: pwCwd, encoding: 'utf8', shell: false });
      report.smoke = { pass: r.status === 0, stdout: r.stdout || '', stderr: r.stderr || '' };
      if (!report.smoke.pass) report.failures.push('smoke');
    } else {
      report.smoke = { pass: true, skipped: true, reason: 'no smoke tests in config' };
    }
  }

  if (args.baseUrl && configPath && args.axe) {
    const pwCwd = findPlaywrightCwd(args.root, skillRoot);
    const r = runNode(
      path.join(scripts, 'axe-check.mjs'),
      ['--config', configPath, '--base-url', args.baseUrl],
      pwCwd,
    );
    report.axe = { pass: r.code === 0, stdout: r.stdout, stderr: r.stderr };
    if (!report.axe.pass) report.failures.push('axe');
  } else if (args.strict && args.axe && args.baseUrl) {
    report.warnings.push('No fragile-surfaces.json — axe gate skipped');
    report.axe = { pass: true, skipped: true };
  }

  const hardFail = report.failures.length > 0;
  if (hardFail) {
    report.verdict = 'FAIL';
  } else if (report.auditFindings > 0 || (report.genericScore !== null && report.genericScore > 0)) {
    report.verdict = 'PASS_WITH_WARNINGS';
  } else {
    report.verdict = 'PASS';
  }

  const outPath = path.resolve(args.root, args.out);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

  console.log(`\nui-check: ${report.verdict}${args.strict ? ' (strict)' : ''}`);
  console.log(`  contrast: ${report.contrast.pass ? 'PASS' : 'FAIL'} (${report.contrast.pairs} pairs)`);
  if (report.genericScore !== null) console.log(`  generic score: ${report.genericScore}${maxGeneric !== null ? ` (max ${maxGeneric})` : ''}`);
  console.log(`  audit findings: ${report.auditFindings}`);
  if (report.auditDiff) console.log(`  audit-diff: ${report.auditDiff.pass ? 'PASS' : 'FAIL'}`);
  if (report.layout) console.log(`  layout: ${report.layout.skipped ? 'SKIP' : report.layout.pass ? 'PASS' : 'FAIL'}`);
  if (report.smoke) console.log(`  smoke: ${report.smoke.skipped ? 'SKIP' : report.smoke.pass ? 'PASS' : 'FAIL'}`);
  if (report.axe) console.log(`  axe: ${report.axe.skipped ? 'SKIP' : report.axe.pass ? 'PASS' : 'FAIL'}`);
  console.log(`  direction lock: ${report.hasDirectionLock ? 'yes' : 'no'}`);
  if (report.failures.length) console.log(`  failures: ${report.failures.join(', ')}`);
  console.log(`\nWrote ${outPath}`);
  console.log('Run: node design-critique.js --root . for SHIP/BLOCK verdict\n');

  process.exit(hardFail ? 1 : 0);
}

main();
