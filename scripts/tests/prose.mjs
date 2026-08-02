import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  root, registry, read, expect, runNode, walk, pathToFileUrl,
  tmpBase, runFixture, assertFixture, ARCH, BACKEND, FRONTEND, ACCEPT,
} from './harness.mjs';

// ---------- 5. ai-prose-slop (skips only when vale is absent; CI installs vale) ----------
{
  const probe = spawnSync('vale', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.log('skip  ai-prose-slop fixtures: vale not installed (CI installs it; install locally to run these)');
  } else {
    const script = path.join(root, 'ai-prose-slop', 'scripts', 'check-prose.js');
    const clean = runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-clean', 'doc.md')]);
    const cleanReport = JSON.parse(clean.stdout);
    expect('ai-prose-slop: clean doc verdict SHIP', cleanReport.verdict === 'SHIP', cleanReport.verdict);
    const slop = runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-slop', 'doc.md')]);
    const slopReport = JSON.parse(slop.stdout);
    // A hit is a finding, so the verdict is BLOCK. This asserted CONDITIONAL
    // while every hit was recorded as not_evaluated — i.e. it pinned the bug:
    // Vale ran and matched, and the report claimed the check could not run.
    expect('ai-prose-slop: slop doc verdict BLOCK', slopReport.verdict === 'BLOCK', slopReport.verdict);
    expect('ai-prose-slop: hits are recorded as findings, not as unevaluated checks',
      slopReport.checks.length > 0 && slopReport.checks.every((c) => c.status === 'fail'),
      JSON.stringify(slopReport.checks.map((c) => c.status)));
    const ids = new Set(slopReport.checks.map((c) => c.id));
    for (const rule of ['AIProseTells.InflatedVocabulary', 'AIProseTells.ThroatClearing', 'AIProseTells.WeaselAttribution',
      'AIProseTells.ImportanceInflation', 'AIProseTells.SummaryRecap', 'AIProseTells.EmDashOveruse',
      'AIProseTells.UnsupportedSuperlative', 'AIProseTells.ParallelFlourish']) {
      expect(`ai-prose-slop: rule fires ${rule}`, ids.has(rule), [...ids].join(', '));
    }
    // Regression: patterns.md claimed "robust" was Vale-checkable while the
    // yml never listed it — the fixture's "robust platform" went unflagged.
    const flaggedTokens = slopReport.checks
      .filter((c) => c.id === 'AIProseTells.InflatedVocabulary')
      .map((c) => (c.detail.match(/'([^']+)'/) || [])[1]);
    expect('ai-prose-slop: "robust" is caught by InflatedVocabulary (doc/rule drift regression)',
      flaggedTokens.includes('robust'), flaggedTokens.join(', '));

    // The following were verified by hand once and never captured as a
    // regression test — automating exactly what was manually exercised.
    const strictClean = runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-clean', 'doc.md'), '--strict']);
    expect('ai-prose-slop: --strict on clean doc exits 0', strictClean.status === 0, `exit ${strictClean.status}`);
    const strictSlop = runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-slop', 'doc.md'), '--strict']);
    expect('ai-prose-slop: --strict on slop doc exits 1', strictSlop.status === 1, `exit ${strictSlop.status}`);

    const dirTarget = runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-slop')]);
    let dirReport = null;
    try { dirReport = JSON.parse(dirTarget.stdout); } catch { /* asserted below */ }
    expect('ai-prose-slop: directory target works', dirReport?.verdict === 'BLOCK', dirTarget.stderr || dirTarget.stdout);

    const reportPath = path.join(tmpBase, 'ai-prose-slop-report-test.json');
    runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-clean', 'doc.md'), '--report', reportPath]);
    expect('ai-prose-slop: --report writes a readable report file',
      fs.existsSync(reportPath) && JSON.parse(read(reportPath)).verdict === 'SHIP', 'report file missing or malformed');

    const multiTarget = runNode(script, [
      path.join(root, 'fixtures', 'ai-prose-slop-clean', 'doc.md'),
      path.join(root, 'fixtures', 'ai-prose-slop-slop', 'doc.md'),
    ]);
    let multiReport = null;
    try { multiReport = JSON.parse(multiTarget.stdout); } catch { /* asserted below */ }
    expect('ai-prose-slop: multiple targets in one invocation', multiReport?.verdict === 'BLOCK', multiTarget.stderr || multiTarget.stdout);

    // The `--` separator (added as hardening) must actually stop a target
    // whose name starts with "-" from being parsed as a vale flag.
    const dashPath = path.join(tmpBase, '--strict');
    fs.copyFileSync(path.join(root, 'fixtures', 'ai-prose-slop-clean', 'doc.md'), dashPath);
    const dashTarget = runNode(script, [dashPath]);
    let dashReport = null;
    try { dashReport = JSON.parse(dashTarget.stdout); } catch { /* asserted below */ }
    expect('ai-prose-slop: a target literally named "--strict" is treated as a path, not a flag',
      dashReport?.verdict === 'SHIP', dashTarget.stderr || dashTarget.stdout);

    // Regression: a vale execution error (bad config, an invalid yml key —
    // this exact scenario broke the whole style while adding
    // UnsupportedSuperlative/ParallelFlourish) must BLOCK loudly, never be
    // swallowed as "vale ran clean with zero findings" via
    // `JSON.parse(emptyStdout || '{}')`.
    const brokenRulePath = path.join(root, 'ai-prose-slop', 'rules', 'AIProseTells', 'ParallelFlourish.yml');
    const goodRule = read(brokenRulePath);
    try {
      fs.writeFileSync(brokenRulePath, 'extends: existence\nmessage: "test"\nexample: "an invalid top-level key"\ntokens:\n  - test\n');
      const crashed = runNode(script, [path.join(root, 'fixtures', 'ai-prose-slop-clean', 'doc.md')]);
      let crashedReport = null;
      try { crashedReport = JSON.parse(crashed.stdout); } catch { /* asserted below */ }
      expect('ai-prose-slop: a vale config error BLOCKs instead of silently reporting SHIP',
        crashedReport?.verdict === 'BLOCK' && crashedReport.checks[0]?.id === 'vale-crashed',
        JSON.stringify(crashedReport));

      // The same invalid key should also be caught statically at generation
      // time, before it ever reaches vale.
      const genResult = runNode(path.join(root, 'ai-prose-slop', 'scripts', 'gen-patterns.mjs'), []);
      expect('gen-patterns.mjs: rejects a real (non-example-comment) invalid yml key at generation time',
        genResult.status !== 0 && (genResult.stderr || '').includes('not a real vale key'),
        (genResult.stderr || '').slice(0, 200));
    } finally {
      fs.writeFileSync(brokenRulePath, goodRule);
    }
  }
}
