import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { root, read, expect } from './harness.mjs';

const node = process.execPath;

// ---------- A run that never reached a model is not a failing run ----------
// Two engineering-assessment runs hit the Codex account's usage limit,
// produced no model turn at all, and were graded as five model FAILURES
// each. Absence of evidence read as evidence of absence — inside the system
// built to prevent exactly that. Both guards below must classify it as an
// environment failure: the message match, and the structural backstop that
// does not depend on any provider's wording.
{
  const src = read(path.join(root, 'scripts', 'eval-run.mjs'));
  const failureMatcher = /const environmentFailure = (\/.*?\/i)\.exec/s.exec(src);
  expect('eval-run declares an environment-failure matcher', Boolean(failureMatcher), 'not found');
  if (failureMatcher) {
    const re = new RegExp(failureMatcher[1].slice(1, -2), 'i');
    const realWorldFailures = [
      "You've hit your usage limit. Upgrade to Pro or try again at Aug 20th",
      'Failed to authenticate',
      'writing is blocked by read-only sandbox',
      'rate limit exceeded',
      'quota exceeded for this project',
      '529 overloaded_error',
    ];
    for (const message of realWorldFailures) {
      expect(`environment failure recognised: "${message.slice(0, 38)}"`, re.test(message), message);
    }
    // It must NOT swallow a genuine model result.
    const realResults = [
      'ASSESSMENT.md written with five findings',
      'the smoke test asserts nothing meaningful',
    ];
    for (const message of realResults) {
      expect(`a real model result is not misread as an environment failure: "${message.slice(0, 30)}"`,
        !re.test(message), message);
    }
  }

  expect('eval-run has a wording-independent backstop for "no model turn"',
    /const noModelTurn =[\s\S]{0,220}totalTokens === null/.test(src),
    'a provider phrasing this differently would be graded as model failures again');
  expect('the backstop feeds the not_evaluated path',
    /if \(environmentFailure \|\| noModelTurn \|\| ambientSkillAccess\)/.test(src));
}

// ---------- Blind judge and assertion diagnostics ----------
// Both came from agentskills.io's evaluation guidance: score holistic quality
// blind, and notice assertions that pass in both arms. Neither feeds
// promotion — they are diagnostics, and the tests pin that boundary.
{
  const judge = path.join(root, 'scripts', 'eval-judge.mjs');
  const runsDir = path.join(root, 'eval', 'runs');
  const bundles = fs.existsSync(runsDir) ? fs.readdirSync(runsDir) : [];
  const skillRun = bundles.find((d) => d.startsWith('engineering-assessment-silent-drop-claude-code-skill-'));
  const controlRun = bundles.find((d) => d.startsWith('engineering-assessment-silent-drop-claude-code-control-'));

  if (!skillRun || !controlRun) {
    console.log('skip  eval-judge: no silent-drop bundles present');
  } else {
    const dry = (a, b) => {
      const r = spawnSync(node, [judge, '--a', a, '--b', b, '--dry-run'], { cwd: root, encoding: 'utf8' });
      try { return JSON.parse(r.stdout); } catch { return null; }
    };
    const first = dry(skillRun, controlRun);
    const again = dry(skillRun, controlRun);
    expect('eval-judge --dry-run reports its blinding without calling a model', Boolean(first?.blinding), JSON.stringify(first));
    expect('eval-judge blinding is stable across invocations',
      first && again && first.blinding.A === again.blinding.A,
      `${first?.blinding?.A} then ${again?.blinding?.A}`);
    expect('eval-judge assigns each run exactly one letter',
      first && first.blinding.A !== first.blinding.B, JSON.stringify(first?.blinding));

    const mismatched = spawnSync(node, [judge, '--a', skillRun, '--b',
      bundles.find((d) => d.startsWith('engineering-assessment-retry-storm-claude-code-skill-')) || controlRun,
      '--dry-run'], { cwd: root, encoding: 'utf8' });
    expect('eval-judge refuses to compare runs from different cases',
      mismatched.status === 2 && /different cases/.test(mismatched.stderr), mismatched.stderr.slice(0, 120));

    const missing = spawnSync(node, [judge, '--a', skillRun, '--dry-run'], { cwd: root, encoding: 'utf8' });
    expect('eval-judge requires both runs', missing.status === 2, `exit ${missing.status}`);
  }

  // The diagnostics must not leak into the promotion path: a judgement file
  // is marked non-evidentiary, and eval-verify must ignore the directory.
  const report = spawnSync(node, [path.join(root, 'scripts', 'eval-report.mjs')], { cwd: root, encoding: 'utf8' });
  let parsed = null;
  try { parsed = JSON.parse(report.stdout); } catch { /* asserted next */ }
  const experiments = parsed?.skills?.['engineering-assessment']?.experiments || [];
  expect('eval-report emits assertion diagnostics per experiment',
    experiments.length > 0 && experiments.every((e) => Array.isArray(e.assertionDiagnostics)),
    `experiments=${experiments.length}`);
  expect('eval-report separates skill versions into their own experiments',
    new Set(experiments.filter((e) => e.skillVersion).map((e) => e.skillVersion)).size >= 2,
    JSON.stringify(experiments.map((e) => e.skillVersion)));
  expect('promotion decision still uses the full rubric, not the discriminating subset',
    !JSON.stringify(parsed?.skills?.['engineering-assessment']?.reasons || []).includes('discriminating'));
}
