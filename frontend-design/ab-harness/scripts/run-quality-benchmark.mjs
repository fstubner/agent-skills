#!/usr/bin/env node
/**
 * Empirical quality benchmark across discovery acceptance workspaces.
 *
 * Usage:
 *   node run-quality-benchmark.mjs [--scenarios-dir path] [--out report.json]
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, '..', '..');
const scripts = path.join(skillRoot, 'scripts');

function parseArgs(argv) {
  const out = {
    scenariosDir: path.resolve('C:/Users/Felix/frontend-design-discovery-tests'),
    out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--scenarios-dir') out.scenariosDir = path.resolve(argv[++i]);
    else if (argv[i] === '--out') out.out = path.resolve(argv[++i]);
  }
  out.out = out.out || path.join(out.scenariosDir, 'quality-benchmark-report.json');
  return out;
}

function runNode(script, args, cwd) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', shell: false });
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function loadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function scoreGeneric(stdout) {
  const m = stdout.match(/Score:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function countAuditUi(stdout) {
  const m = stdout.match(/(\d+) total finding/);
  return m ? Number(m[1]) : 0;
}

function listCssFiles(dir) {
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.css') && !name.includes('.dark.'))
    .map((name) => path.join(dir, name));
}

function computeQualityScore(row) {
  if (row.skipped) return null;
  let score = 100;
  if (row.genericScore !== null) score -= row.genericScore * 8;
  score -= Math.min(row.auditUiFindings * 3, 30);
  if (row.contrastPass === false) score -= 40;
  if (row.critiqueVerdict === 'BLOCK') score -= 25;
  else if (row.critiqueVerdict === 'CONDITIONAL' && row.critiqueBlockers?.length) score -= 5;
  return Math.max(0, Math.round(score));
}

function benchmarkScenario(name, dir) {
  const row = { scenario: name, dir };
  if (!fs.existsSync(dir)) {
    row.skipped = true;
    row.reason = 'directory missing';
    return row;
  }

  const ctx = loadJson(path.join(dir, 'design-profile.json'));
  row.scopeTier = ctx.scopeTier || null;

  const cssFiles = listCssFiles(dir);
  const mainCss = cssFiles.find((f) => f.endsWith('styles.css')) || cssFiles[0];
  row.cssFile = mainCss ? path.basename(mainCss) : null;

  if (mainCss) {
    const genArgs = [mainCss];
    const tokens = path.join(dir, 'design-tokens.json');
    if (fs.existsSync(tokens)) genArgs.push(tokens);
    genArgs.push('--root', dir);
    const gen = runNode(path.join(scripts, 'audit-generic.js'), genArgs, dir);
    row.genericScore = scoreGeneric(gen.stdout);
    const modeMatch = gen.stdout.match(/\(([^)]+)\)\s*\n/);
    row.genericMode = modeMatch ? modeMatch[1] : null;
  } else {
    row.genericScore = null;
  }

  let auditTotal = 0;
  for (const f of cssFiles) {
    const r = runNode(path.join(scripts, 'audit-ui.js'), [f], dir);
    auditTotal += countAuditUi(r.stdout);
  }
  row.auditUiFindings = auditTotal;

  const tokensPath = path.join(dir, 'design-tokens.json');
  if (fs.existsSync(tokensPath)) {
    const c = runNode(path.join(scripts, 'check-tokens-contrast.js'), [tokensPath], dir);
    row.contrastPass = c.code === 0;
    row.contrastPairs = (c.stdout.match(/PASS/g) || []).length;
  } else {
    row.contrastPass = null;
  }

  runNode(path.join(scripts, 'design-critique.js'), ['--root', dir], dir);
  const critReport = loadJson(path.join(dir, 'design-critique-report.json'));
  row.critiqueVerdict = critReport.verdict || 'UNKNOWN';
  row.critiqueBlockers = critReport.blockers || [];

  row.qualityScore = computeQualityScore(row);
  return row;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scenarios = fs.readdirSync(args.scenariosDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('scenario-'))
    .map((d) => d.name)
    .sort();

  console.log('\nquality-benchmark\n');
  const results = scenarios.map((name) => benchmarkScenario(name, path.join(args.scenariosDir, name)));
  const scored = results.filter((r) => !r.skipped);

  const report = {
    generatedAt: new Date().toISOString(),
    skillRoot,
    scenariosDir: args.scenariosDir,
    aggregate: {
      scenarios: results.length,
      avgQualityScore: scored.length
        ? Math.round(scored.reduce((s, r) => s + r.qualityScore, 0) / scored.length)
        : null,
      totalGenericFindings: scored.reduce((s, r) => s + (r.genericScore || 0), 0),
      totalAuditUiFindings: scored.reduce((s, r) => s + r.auditUiFindings, 0),
      blockVerdicts: scored.filter((r) => r.critiqueVerdict === 'BLOCK').length,
    },
    results,
  };

  fs.writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n');

  for (const r of results) {
    if (r.skipped) {
      console.log(`  SKIP  ${r.scenario}`);
      continue;
    }
    console.log(
      `  ${r.scenario.padEnd(22)} quality=${String(r.qualityScore).padStart(3)}  generic=${r.genericScore ?? '-'}  audit-ui=${r.auditUiFindings}  critique=${r.critiqueVerdict}`,
    );
  }
  console.log(`\naggregate quality score: ${report.aggregate.avgQualityScore}`);
  console.log(`Wrote ${args.out}\n`);
}

main();
