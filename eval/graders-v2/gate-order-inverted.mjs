#!/usr/bin/env node
// Deterministic grader for gate-order-inverted.
//
// The pipeline chains staging -> integration -> unit -> lint -> production, so
// a missing semicolon is found 24 minutes in, after a deploy and the slow
// suite have already run. Every check is present; the order is the defect.
//
// release-engineering rule 2: cheap, fast checks gate before slow, expensive
// ones. What is graded is the dependency graph, not the order the jobs happen
// to be written in the file — YAML mapping order does not run anything.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node gate-order-inverted.mjs --root <workspace>');
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

// --- job graph -------------------------------------------------------------
// Two-space keys under `jobs:` are job names; the body runs to the next such
// key. `\s\s` rather than a braced quantifier: the suite's nesting checker
// counts brace characters and reads a regex quantifier as an object literal.
// Scoped to the `jobs:` mapping — at two spaces of indent, `push:` under
// `on:` is indistinguishable from a job name.
function jobBlocks(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => /^jobs\s*:\s*$/.test(line));
  if (start < 0) return [];
  const found = [];
  for (let n = start + 1; n < lines.length; n += 1) {
    if (/^\S/.test(lines[n])) break;
    const header = /^\s\s([A-Za-z0-9_-]+)\s*:\s*$/.exec(lines[n]);
    if (header) found.push({ name: header[1], lines: [] });
    else if (found.length > 0) found[found.length - 1].lines.push(lines[n]);
  }
  return found.map((j) => ({ name: j.name, body: j.lines.join('\n') }));
}

// `needs: a`, `needs: [a, b]`, and the block-sequence form all mean the same
// thing to Actions, so all three have to mean the same thing here.
function needsOf(body) {
  const inline = /^\s+needs\s*:\s*(.*)$/m.exec(body);
  if (!inline) return [];
  const value = inline[1].trim();
  if (value.startsWith('[')) return value.replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  if (value.length > 0) return [value];
  const items = [];
  for (const line of body.slice(inline.index + inline[0].length).split('\n').slice(1)) {
    const item = /^\s+-\s*([A-Za-z0-9_-]+)\s*$/.exec(line);
    if (!item) break;
    items.push(item[1]);
  }
  return items;
}

const jobs = new Map(jobBlocks(workflow).map((j) => [j.name, { ...j, needs: needsOf(j.body) }]));

function dependsOn(name, targetPredicate, seen = new Set()) {
  const job = jobs.get(name);
  if (!job || seen.has(name)) return false;
  seen.add(name);
  for (const dep of job.needs) {
    if (targetPredicate(dep, jobs.get(dep))) return true;
    if (dependsOn(dep, targetPredicate, seen)) return true;
  }
  return false;
}

const LINT = /npm\s+run\s+lint|\beslint\b/;
const UNIT = /npm\s+test\b|npm\s+run\s+test\b|node\s+--test\s+test/;
const SLOW = /test:integration|node\s+--test\s+integration/;
const DEPLOY = /deploy\.sh|kubectl|helm\s+upgrade/;

const kind = (predicate) => (name, job) => Boolean(job) && predicate.test(job.body);
const jobsMatching = (predicate) => [...jobs.values()].filter((j) => predicate.test(j.body));

// Every check the fixture had must still be there. Deleting the slow suite
// makes the pipeline fast and worse, and satisfies every ordering rule below.
const keptAll = LINT.test(workflow) && UNIT.test(workflow) && SLOW.test(workflow);
record('no-check-dropped', keptAll,
  `lint=${LINT.test(workflow)} unit=${UNIT.test(workflow)} integration=${SLOW.test(workflow)}`);

const slowJobs = jobsMatching(SLOW).filter((j) => !LINT.test(j.body) && !DEPLOY.test(j.body));
const deployJobs = jobsMatching(DEPLOY).filter((j) => !SLOW.test(j.body));

record('lint-gates-the-slow-suite',
  slowJobs.length > 0 && slowJobs.every((j) => LINT.test(j.body) || dependsOn(j.name, kind(LINT))),
  `integration jobs=${slowJobs.map((j) => j.name).join(',') || 'none'} each reached by lint=${slowJobs.every((j) => LINT.test(j.body) || dependsOn(j.name, kind(LINT)))}`);

record('unit-tests-gate-the-slow-suite',
  slowJobs.length > 0 && slowJobs.every((j) => dependsOn(j.name, kind(UNIT))),
  `integration jobs depend on a unit-test job=${slowJobs.every((j) => dependsOn(j.name, kind(UNIT)))}`);

record('nothing-deploys-before-the-tests',
  deployJobs.length > 0 && deployJobs.every((j) => dependsOn(j.name, kind(UNIT)) && dependsOn(j.name, kind(SLOW))),
  `deploying jobs=${deployJobs.map((j) => j.name).join(',') || 'none'}; all gated by unit and integration=${deployJobs.every((j) => dependsOn(j.name, kind(UNIT)) && dependsOn(j.name, kind(SLOW)))}`);

// A root job is one Actions starts immediately. If a deploy or the slow suite
// is a root, something expensive begins before any cheap check has reported.
const roots = [...jobs.values()].filter((j) => j.needs.length === 0);
const expensiveRoots = roots.filter((j) => SLOW.test(j.body) || DEPLOY.test(j.body));
record('no-expensive-job-starts-unconditionally', jobs.size > 0 && expensiveRoots.length === 0,
  `jobs with no needs: ${roots.map((j) => j.name).join(',') || 'none'}; expensive among them: ${expensiveRoots.map((j) => j.name).join(',') || 'none'}`);

record('deploy-path-intact', /kubectl|rollout/.test(readIf('scripts/deploy.sh')),
  'scripts/deploy.sh must still deploy');
record('app-unchanged', /createApp/.test(readIf('src/server.js')),
  'src/server.js must keep its exported createApp');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'gate-order-inverted', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
