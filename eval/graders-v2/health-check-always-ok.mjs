#!/usr/bin/env node
// Deterministic grader for health-check-always-ok.
//
// The pipeline does everything rule 7 asks: it watches /health for ten minutes
// after a deploy and rolls back on a bad reading. /health returns 200 whatever
// is happening. On 12 August the database was unreachable for 22 minutes,
// every real request failed, and the watch stayed green.
//
// So this case is the layer under rule 7: an observation is only worth
// building a gate on if the thing observed can report bad news. What is graded
// is whether the check can fail, not whether the route exists.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node health-check-always-ok.mjs --root <workspace>');
  process.exit(2);
}

const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const readIf = (rel) => {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
};

const server = readIf('src/server.js');
const lines = server.split('\n');
const routeAt = lines.findIndex((line) => /['"`]\/(health|healthz|readyz|ready)\b/.test(line));
record('health-route-present', routeAt >= 0, `health route declared at line ${routeAt + 1}`);

// The handler, approximated as the twenty lines from its registration. Longer
// than any reasonable health handler and short enough not to swallow the rest
// of the file.
const handler = routeAt >= 0 ? lines.slice(routeAt, routeAt + 20).join('\n') : '';

// Every request this service serves needs the database, so a check that does
// not touch it is not checking whether the service can serve.
const touchesDependency = /\bquery\s*\(|\bpool\b|\bdb\b|SELECT\s+1|ping|healthCheck/i.test(handler);
record('health-checks-its-dependency', touchesDependency,
  `the handler exercises the database=${touchesDependency}`);

// The defect in one line: there is no code path that reports bad news.
// `[^)]*` rather than an anchored code: `res.status(healthy ? 200 : 503)` is
// the ordinary way to write this and puts the failing code mid-expression.
const canFail = /status\s*\([^)]*\b(503|500|502|424)\b/.test(handler)
  || /sendStatus\s*\([^)]*\b(503|500)\b/.test(handler)
  || /statusCode\s*=\s*(503|500)/.test(handler);
// Both halves in one assertion: a branch has to exist for that path to be
// reachable, and `res.status(200)` beside a dead 503 line would satisfy either
// half alone. Scoring them separately would score one fix twice.
const branches = /\bif\s*\(|\?\s*[^\n]*:|catch\s*\(|\.catch\s*\(/.test(handler);
record('health-can-report-unhealthy', canFail && branches,
  `a non-2xx path exists=${canFail}; it sits behind a branch=${branches}`);

// A probe that throws instead of answering is a health check that takes the
// process down when its dependency wobbles.
const guarded = /try\s*\{|\.catch\s*\(/.test(handler);
record('dependency-failure-is-caught', guarded,
  `the dependency call is guarded=${guarded}`);

// The reading lands in front of an on-call rota at 3am. "degraded" without
// saying what is degraded costs them the first ten minutes.
const attributes = /checks|dependenc|database|reason|error|detail/i.test(handler);
record('failure-names-what-failed', attributes,
  `the response body identifies the failing dependency=${attributes}`);

// Base-model guards. Neither is credited to the skill.
record('entries-endpoint-intact', /\/entries\/:id/.test(server) && /createApp/.test(server),
  'src/server.js must keep createApp and its /entries/:id route');

function workflowText() {
  const dir = path.join(root, '.github', 'workflows');
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir)
    .filter((name) => /\.ya?ml$/i.test(name))
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))
    .join('\n');
}
const workflow = workflowText();
record('post-deploy-watch-intact', /health/i.test(workflow) && /rollout\s+undo|rollback/i.test(workflow),
  'the pipeline must still watch health and still roll back on a bad reading');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'health-check-always-ok', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
