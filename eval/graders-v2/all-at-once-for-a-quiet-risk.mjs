#!/usr/bin/env node
// Deterministic grader for all-at-once-for-a-quiet-risk.
//
// Fee rounding moves from per-line to invoice-total, and the pipeline rolls it
// to every pod at once. Rule 4's floor is already met — there is a documented
// one-command rollback — which is the point of the case: the rollback is fine
// and useless here. A wrong fee raises no error and fails no health check, so
// nothing tells anyone to run it until reconciliation disagrees the next
// morning, by which time every invoice in the window is wrong.
//
// release-engineering rule 4, second half: pick blue-green or canary based on
// whether the risk is "this build is broken" or "this build is subtly wrong
// under real traffic". This is the second.
//
// Graded as partial exposure rather than as canary specifically. A percentage
// traffic split and a flag rolled out to a fraction of accounts (rule 5) are
// both real answers to this risk, and a grader that only recognised one of
// them would be scoring a mechanism instead of the decision.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node all-at-once-for-a-quiet-risk.mjs --root <workspace>');
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
const release = readIf('RELEASE.md') || readIf('docs/RELEASE.md');
record('release-doc-present', release.trim().length > 0, `RELEASE.md bytes=${release.length}`);

// Base-model guard. Rule 4's floor was already met and must stay met.
record('rollback-command-retained', /rollout\s+undo|helm\s+rollback|--to-revision/.test(release),
  'the documented one-command rollback must survive');

// Scoped to the `jobs:` mapping — at two spaces of indent, `push:` under
// `on:` is indistinguishable from a job name.
function jobBlocks(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => /^jobs\s*:\s*$/.test(line));
  if (start < 0) return [];
  const found = [];
  for (let n = start + 1; n < lines.length; n += 1) {
    if (/^\S/.test(lines[n])) break;
    // A comment at two spaces of indent introduces the job below it. Treating
    // it as part of the job above put the canary stage's own "5% of traffic"
    // note into the body of the preceding job, which then scored as a partial
    // rollout it has nothing to do with.
    if (/^\s\s#/.test(lines[n])) continue;
    const header = /^\s\s([A-Za-z0-9_-]+)\s*:\s*$/.exec(lines[n]);
    if (header) found.push({ name: header[1], lines: [] });
    else if (found.length > 0) found[found.length - 1].lines.push(lines[n]);
  }
  return found.map((j) => ({ name: j.name, body: j.lines.join('\n') }));
}
const jobs = jobBlocks(workflow);

const PARTIAL = /canary|\b\d\d?\s?%|percent|weight|traffic[- ]split|subset|\bcohort\b|rollout[-_ ]?percentage|maxSurge\s*:\s*1\b/i;
const FULL = /remaining pods|all pods|full roll|rollout status|deploy\.sh\s+production\b/i;

// `needs:` lines are stripped before asking what a job does: a full rollout
// that depends on a job called `canary` names it, and would otherwise be
// classified as the canary itself.
const work = (job) => job.body.split('\n').filter((line) => !/^\s+needs\s*:/.test(line)).join('\n');

const partialJobs = jobs.filter((j) => PARTIAL.test(work(j)));
record('partial-exposure-stage-exists', partialJobs.length > 0,
  `jobs exposing the change to part of the traffic: ${partialJobs.map((j) => j.name).join(',') || 'none'}`);

// Exposure without observation is just a slower way to be wrong everywhere.
// And the thing observed has to be the numbers: a health check stays green
// through a bad fee, which the README says outright.
const OBSERVES = /compare|reconcil|disagree|diff|verify|check[- ]fees|error rate|watch/i;
const observed = partialJobs.some((j) => OBSERVES.test(work(j)));
record('partial-exposure-is-observed', observed,
  `the partial stage compares or checks something before proceeding=${observed}`);

// And the full rollout must not start regardless of what the observation said.
const fullJobs = jobs.filter((j) => FULL.test(work(j)) && !PARTIAL.test(work(j)));
const gated = fullJobs.length > 0 && partialJobs.length > 0
  && fullJobs.every((j) => partialJobs.some((p) => new RegExp(`needs\\s*:\\s*\\[?[^\\n]*${p.name}`).test(j.body)));
record('full-rollout-gated-on-the-partial-stage', gated,
  `full-rollout jobs=${fullJobs.map((j) => j.name).join(',') || 'none'}; each depends on the partial stage=${gated}`);

// Rule 4 asks for a choice made on the shape of the risk. Whether the choice
// was right is arguable forever; whether the reason is written down is not.
const namesTheRisk = /(quiet|subtl|silent|invisible|no error|not (an )?error|looks? normal|under real traffic|reconcil)/i.test(release);
const namesTheChoice = /(canary|percentage|small (percentage|slice|fraction)|blue-?green|partial)/i.test(release);
record('rollout-choice-recorded-with-its-reason', namesTheRisk && namesTheChoice,
  `the doc names the shape of the risk=${namesTheRisk}; it names the rollout choice=${namesTheChoice}`);

// Base-model guards. The change being released is not the thing to undo, and
// the tests still have to gate.
record('pricing-change-intact', /rateBasisPoints/.test(readIf('src/pricing.js')),
  'src/pricing.js must keep the new invoice-total fee calculation');
record('tests-still-gate-the-deploy', /npm\s+test|node\s+--test/.test(workflow) && /needs\s*:/.test(workflow),
  'the test job must still gate what follows it');
record('app-unchanged', /createApp/.test(readIf('src/server.js')),
  'src/server.js must keep its exported createApp');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'all-at-once-for-a-quiet-risk', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
