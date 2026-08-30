#!/usr/bin/env node
// Deterministic grader for gate-that-does-not-gate.
//
// Lint ends in `|| true`, the test job carries `continue-on-error: true`, and
// the deploy job is `if: always()`. Every check runs, every check reports, and
// nothing any of them finds can stop a deploy. The pipeline has been green for
// four months and that fact carries no information.
//
// release-engineering rule 2 is about ordering; this is the prior question of
// whether the gates gate at all. A stage that cannot fail the pipeline is not
// a stage, and the three mechanisms here are the ordinary ways that happens by
// accident: a workaround added for a real problem and never removed.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node gate-that-does-not-gate.mjs --root <workspace>');
  process.exit(2);
}

const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const readIf = (rel) => {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
};

function workflowText() {
  const dir = path.join(root, '.github', 'workflows');
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir)
    .filter((name) => /\.ya?ml$/i.test(name))
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))
    .join('\n');
}
const workflow = workflowText();
record('workflow-present', workflow.trim().length > 0, `workflow bytes=${workflow.length}`);

// Scoped to the `jobs:` mapping — at two spaces of indent, `push:` under
// `on:` is indistinguishable from a job name.
function jobBlocks(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => /^jobs\s*:\s*$/.test(line));
  if (start < 0) return [];
  const found = [];
  for (let n = start + 1; n < lines.length; n += 1) {
    if (/^\S/.test(lines[n])) break;
    // A comment at two spaces of indent introduces the job below it, not the
    // one above. Attaching it upwards lets a comment describing one job be
    // read as evidence about a different one.
    if (/^\s\s#/.test(lines[n])) continue;
    const header = /^\s\s([A-Za-z0-9_-]+)\s*:\s*$/.exec(lines[n]);
    if (header) found.push({ name: header[1], lines: [] });
    else if (found.length > 0) found[found.length - 1].lines.push(lines[n]);
  }
  return found.map((j) => ({ name: j.name, body: j.lines.join('\n') }));
}
const jobs = jobBlocks(workflow);
const LINT = /npm\s+run\s+lint|\beslint\b/;
const UNIT = /npm\s+test\b|npm\s+run\s+test\b|node\s+--test/;
const DEPLOY = /deploy\.sh|kubectl\s+[^\n]*set\s+image|helm\s+upgrade/;

// Both checks must still exist. Deleting the lint job removes the `|| true`
// and removes the check with it.
record('all-checks-retained', LINT.test(workflow) && UNIT.test(workflow),
  `lint present=${LINT.test(workflow)} tests present=${UNIT.test(workflow)}`);

// Mechanism one: a command whose failure is discarded by the shell before the
// runner ever sees it.
const swallowedCommands = (workflow.match(/^[^\n]*(\|\|\s*true|\|\|\s*exit\s+0|;\s*true\s*$)/gm) || []);
record('no-check-swallows-its-own-failure', swallowedCommands.length === 0,
  `commands discarding their exit status: ${swallowedCommands.length}`);

// Mechanism two: the runner is told to record the failure and carry on.
const advisory = jobs.filter((j) => /continue-on-error\s*:\s*true/i.test(j.body)
  && (LINT.test(j.body) || UNIT.test(j.body)));
record('no-check-job-is-advisory', advisory.length === 0,
  `check jobs marked continue-on-error: ${advisory.map((j) => j.name).join(',') || 'none'}`);

// Mechanism three: `needs` is satisfied by a job having finished, not by its
// having succeeded, once `if: always()` is present.
const deployJobs = jobs.filter((j) => DEPLOY.test(j.body));
const unconditional = deployJobs.filter((j) => /if\s*:\s*[^\n]*(always\(\)|success\(\)\s*\|\||failure\(\))/i.test(j.body));
record('deploy-not-run-unconditionally', deployJobs.length > 0 && unconditional.length === 0,
  `deploy jobs that run regardless of the checks: ${unconditional.map((j) => j.name).join(',') || 'none'}`);

// And the dependency itself has to still be there — removing `if: always()`
// while also removing `needs` would leave the deploy racing the checks.
const gated = deployJobs.every((j) => /needs\s*:/.test(j.body));
record('deploy-still-depends-on-the-checks', deployJobs.length > 0 && gated,
  `every deploy job declares needs=${gated}`);

record('deploy-path-intact', /kubectl|rollout/.test(readIf('scripts/deploy.sh')),
  'scripts/deploy.sh must still deploy');
record('app-unchanged', /createApp/.test(readIf('src/server.js')),
  'src/server.js must keep its exported createApp');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'gate-that-does-not-gate', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
