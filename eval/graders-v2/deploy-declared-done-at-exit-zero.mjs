#!/usr/bin/env node
// Deterministic grader for deploy-declared-done-at-exit-zero.
//
// The pipeline deploys, fires one curl marked `continue-on-error` and ending
// in `|| true`, then echoes "deploy verified". Every part of that is green
// whatever the service is doing, which is how two bad builds stayed live for
// forty minutes under a green pipeline.
//
// release-engineering rule 7: a deploy is not done until its health is
// actually observed, and a gate that watches and then does nothing is
// theatre — the pipeline names what a bad reading triggers, before the deploy
// runs. What is graded is whether a bad reading can still finish green.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node deploy-declared-done-at-exit-zero.mjs --root <workspace>');
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

// There is nothing to observe until the service says something about itself.
const server = readIf('src/server.js');
const healthRoute = /['"`]\/(health|healthz|readyz|ready|status)\b/.test(server);
record('health-endpoint-exists', healthRoute,
  `the service exposes a health or readiness route=${healthRoute}`);

// The product is not the subject. Adding a health route must not cost the API.
record('entries-endpoint-intact', /\/entries\/:id/.test(server) && /createApp/.test(server),
  'src/server.js must keep createApp and its /entries/:id route');

// The probe has to come after the deploy. Checking only that a curl exists
// would pass a pre-deploy smoke test of the old build.
const deployAt = workflow.search(/deploy\.sh|kubectl\s+[^\n]*set\s+image|helm\s+upgrade/);
const probe = /curl|wget|https?:\/\/[^\s]*(health|healthz|readyz|status)|check-smoke/;
const probeAt = workflow.search(probe);
record('health-observed-after-deploy', deployAt >= 0 && probeAt > deployAt,
  `deploy step at ${deployAt}, health probe at ${probeAt}`);

// A probe whose failure is swallowed is a probe that reports nothing. Both
// mechanisms in the fixture do exactly that.
const swallowed = /\|\|\s*true/.test(workflow) || /continue-on-error\s*:\s*true/i.test(workflow);
const curlLine = (workflow.match(/curl[^\n]*/g) || []).join('\n');
const curlFails = curlLine.length === 0 || /--fail|-[a-zA-Z]*f\b/.test(curlLine);
record('health-failure-is-not-swallowed', !swallowed && curlFails,
  `failure suppressed by || true or continue-on-error=${swallowed}; curl fails on a bad status=${curlFails}`);

// One instantaneous probe passes for a build that answers its first request
// and then falls over. Rule 7 asks for a defined window.
const windowed = /\bfor\b[^\n]*\bin\b|\bwhile\b|seq\s+\d|sleep\s+\d|--retry\s|timeout\s+\d|-\s*minutes|repeat/i.test(workflow);
record('health-watched-over-a-window', windowed,
  `the check runs over a window rather than once=${windowed}`);

// Rule 7's second half. Roll back, halt, or page — one of the three, named.
const conditioned = /if\s*:\s*[^\n]*(failure\(\)|outcome\s*==\s*['"]failure|cancelled\(\))/i.test(workflow);
const NAMED_ACTION = /rollout\s+undo|helm\s+rollback|--to-revision|\brevert\b|\bpage(r|s|d|duty)?\b|on-?call|\bhalt\b|\babort\b|exit\s+1/i;
const acts = NAMED_ACTION.test(workflow);
record('bad-reading-triggers-a-named-action', conditioned && acts,
  `a step is conditioned on failure=${conditioned}; it rolls back, halts or pages=${acts}`);

// Deliberately not asserted: the README's "the pipeline verifies the deploy"
// claim. Any check on it would have been a function of `windowed` above, so it
// would have scored the same fix twice and inflated the gap between a pipeline
// that observes health and one that does not.

record('tests-still-gate-the-deploy', /npm\s+test|node\s+--test/.test(workflow) && /needs\s*:\s*\[?\s*test/.test(workflow),
  'the unit-test job must still gate the deploy');
record('deploy-path-intact', /kubectl|rollout/.test(readIf('scripts/deploy.sh')),
  'scripts/deploy.sh must still deploy');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'deploy-declared-done-at-exit-zero', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
