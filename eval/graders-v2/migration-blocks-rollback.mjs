#!/usr/bin/env node
// Deterministic grader for migration-blocks-rollback.
//
// Migration 0007 drops `legacy_amount` and makes `amount_minor` NOT NULL, and
// it runs as a step inside the production deploy job. So the documented
// thirty-second `rollout undo` puts back an image that reads a column no
// longer there: the rollback is written down, tested, and silently unusable
// for this release.
//
// release-engineering rule 6: schema migrations are a deploy hazard on their
// own timeline, sequenced additive-first specifically so a code rollback never
// depends on a schema rollback. What is graded is whether the rollback still
// works after this deploy, not whether the word "migration" is discussed.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node migration-blocks-rollback.mjs --root <workspace>');
  process.exit(2);
}

const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const readIf = (rel) => {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
};

function migrations() {
  const dir = path.join(root, 'migrations');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => ({ name, sql: fs.readFileSync(path.join(dir, name), 'utf8') }));
}
const files = migrations();
record('migrations-present', files.length > 0, `migration files: ${files.map((f) => f.name).join(',') || 'none'}`);

// The whole point of the case. Any contraction applied by this deploy is what
// makes the documented rollback unusable.
const DESTRUCTIVE = /DROP\s+(COLUMN|TABLE)|ALTER\s+COLUMN[^\n;]*SET\s+NOT\s+NULL|RENAME\s+(COLUMN|TO)|DROP\s+NOT\s+NULL|TYPE\s+\w+\s+USING/i;
const destructive = files.filter((f) => DESTRUCTIVE.test(f.sql));
record('no-contraction-ships-with-this-deploy', files.length > 0 && destructive.length === 0,
  `migrations containing a destructive change: ${destructive.map((f) => f.name).join(',') || 'none'}`);

// Deleting the migration set passes the check above and ships nothing the
// code needs. The additive work has to survive.
const keepsAdditive = files.some((f) => /amount_minor/i.test(f.sql));
record('additive-change-retained', keepsAdditive,
  `a migration still establishes amount_minor=${keepsAdditive}`);

function workflowText() {
  const dir = path.join(root, '.github', 'workflows');
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir)
    .filter((name) => /\.ya?ml$/i.test(name))
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))
    .join('\n');
}
const workflow = workflowText();

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

const MIGRATE = /npm\s+run\s+migrate|migrate\.js|\bflyway\b|\bliquibase\b|\bmigrate\s+up\b/i;
const DEPLOY = /deploy\.sh|kubectl\s+[^\n]*set\s+image|helm\s+upgrade/i;
const jobs = jobBlocks(workflow);
const coupled = jobs.filter((j) => MIGRATE.test(j.body) && DEPLOY.test(j.body));
record('migration-not-coupled-to-the-code-deploy', jobs.length > 0 && coupled.length === 0,
  `jobs that both migrate and deploy: ${coupled.map((j) => j.name).join(',') || 'none'}`);

// Base-model guard: a pipeline that no longer migrates satisfies the coupling
// check by doing less.
record('migrations-still-applied', MIGRATE.test(workflow),
  `the pipeline still applies migrations=${MIGRATE.test(workflow)}`);

const release = readIf('RELEASE.md') || readIf('docs/RELEASE.md');
record('release-doc-present', release.trim().length > 0, `RELEASE.md bytes=${release.length}`);

// Rule 6 exists so a rollback stays a rollback. Saying so is what makes the
// constraint survive the next person who wants to tidy up the migration set.
const explainsSafety = /roll\s?back|rollback/i.test(release)
  && /(additive|removes nothing|not remove|still there|previous image|backward)/i.test(release);
record('rollback-safety-explained', explainsSafety,
  `the doc says why a code rollback is safe against this schema=${explainsSafety}`);

// The contraction is deferred, not forgotten — with the condition that
// releases it.
const defersContraction = /(drop|remove|contract)[^\n]*legacy_amount|legacy_amount[^\n]*(drop|remove)/i.test(release)
  && /(separate release|later release|once|until|after|follow-?up)/i.test(release);
record('deferred-contraction-recorded', defersContraction,
  `the doc records the deferred drop and what releases it=${defersContraction}`);

record('app-unchanged', /amount_minor/.test(readIf('src/server.js')),
  'src/server.js must still read amount_minor');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'migration-blocks-rollback', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
