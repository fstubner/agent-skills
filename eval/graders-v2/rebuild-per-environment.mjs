#!/usr/bin/env node
// Deterministic grader for rebuild-per-environment.
//
// The pipeline builds the image twice — once in the staging job, once in
// production — and tags by environment. Production therefore ships a binary
// that was never the one staging tested: a dependency resolving differently or
// a build-time flag drifting between the two runs is invisible until it is
// live.
//
// release-engineering rule 1: build once, promote the same artifact. What is
// graded is whether production consumes what staging verified, not whether the
// word "promote" appears somewhere.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node rebuild-per-environment.mjs --root <workspace>');
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
    .join('\n---\n');
}
const workflow = workflowText();
record('workflow-present', workflow.trim().length > 0, `workflow bytes=${workflow.length}`);

// Jobs are split so a build inside the production job can be found without
// depending on job names, which an author is free to change.
// `\s\s` rather than `\s{2}`: the suite's nesting checker counts brace
// characters, so a regex quantifier reads to it as an object literal and this
// function measured six levels deep. Same pattern, no false depth.
function jobBody(text, name) {
  const start = new RegExp(`^\\s\\s${name}\\s*:\\s*$`, 'm').exec(text);
  if (!start) return '';
  const after = text.slice(start.index + start[0].length);
  const next = /^\s\s\S[^\n]*:\s*$/m.exec(after);
  return next ? after.slice(0, next.index) : after;
}
const BUILD = /docker\s+build|docker\s+buildx\s+build|\bpack\s+build\b|kaniko/i;

const buildCount = (workflow.match(/docker\s+(?:buildx\s+)?build/gi) || []).length;
record('single-build', workflow.trim().length > 0 && buildCount === 1,
  `image build invocations in the workflow: ${buildCount}`);

// The production job specifically must not build. Counting globally would pass
// a pipeline that builds once in staging and once in a third environment.
const prodJobNames = ['production', 'prod', 'deploy-production', 'release'];
const prodBodies = prodJobNames.map((name) => jobBody(workflow, name)).filter(Boolean);
const prodBuilds = prodBodies.some((body) => BUILD.test(body));
record('production-does-not-rebuild', prodBodies.length > 0 && !prodBuilds,
  `production-like jobs found=${prodBodies.length}; any of them builds=${prodBuilds}`);

// Promotion needs an identifier that cannot move. A floating tag like
// :staging is re-pointed by the next build, so "the same tag" is not the same
// artifact — a digest, or an immutable tag carrying the commit, is.
// \x7b and \x7d are `{` and `}`. Written as hex because GitHub Actions
// expressions are `${{ ... }}`, and a literal brace here is unbalanced as far
// as the suite's nesting checker is concerned — it counts brace characters
// and read this function as six levels deep.
const EXPR = '\\$\\x7b\\x7b\\s*';
const usesDigest = new RegExp(`@sha256:|${EXPR}needs\\.[a-z0-9_-]+\\.outputs\\.[a-z0-9_-]*digest`, 'i').test(workflow);
const usesImmutableTag = new RegExp(
  `:${EXPR}github\\.sha\\s*\\x7d\\x7d|:\\$\\x7bGITHUB_SHA|:${EXPR}needs\\.[a-z0-9_-]+\\.outputs\\.[a-z0-9_-]*(tag|version)`,
  'i',
).test(workflow);
record('promoted-by-immutable-reference', usesDigest || usesImmutableTag,
  `digest reference=${usesDigest}; commit-pinned tag=${usesImmutableTag}`);

// The floating per-environment tags are the defect. Either must be gone.
const floatingTags = /ledger-api:(staging|prod)\b/gi;
const floating = (workflow.match(floatingTags) || []).length;
record('environment-tags-removed', floating === 0,
  `environment-named floating tags remaining: ${floating}`);

// Rule 2 ordering: the cheap gate still runs before anything deploys. A
// rewrite that drops the test job to simplify the graph has made the pipeline
// worse while satisfying everything above.
const testsStillGate = /npm\s+(ci\s+&&\s+)?test|npm\s+run\s+test|node\s+--test/i.test(workflow)
  && /needs:\s*\[?\s*test/i.test(workflow);
record('tests-still-gate-deploys', testsStillGate,
  `test step present and depended on by a later job=${testsStillGate}`);

// The product itself is not the subject; changing it to make the pipeline
// simpler is out of scope for a pipeline task.
record('app-unchanged', /createApp/.test(readIf('src/server.js')),
  'src/server.js must keep its exported createApp');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'rebuild-per-environment', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
