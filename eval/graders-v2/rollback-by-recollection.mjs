#!/usr/bin/env node
// Deterministic grader for rollback-by-recollection.
//
// RELEASE.md's recovery section is a description of a rollback rather than a
// rollback: ask a colleague, find the previous tag in CI history, deploy it
// the same way, and remember to check the config map. Every step is a thing
// somebody has to work out correctly at 3am.
//
// release-engineering rule 4: the bar is one documented command or one
// pipeline action, written into RELEASE.md as a literal. What is graded is
// whether an operator who has never done it before can execute it, not whether
// the word "rollback" now appears.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node rollback-by-recollection.mjs --root <workspace>');
  process.exit(2);
}

const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const readIf = (rel) => {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
};

const release = readIf('RELEASE.md') || readIf('docs/RELEASE.md');
record('release-doc-present', release.trim().length > 0, `RELEASE.md bytes=${release.length}`);

// A literal command in a fenced block or an indented code line. Prose that
// says "run the rollback script" is the thing being replaced.
const fenced = [...release.matchAll(/```[\s\S]*?```/g)].map((m) => m[0]).join('\n');
const commandish = /\b(kubectl|helm|docker|\.\/scripts\/[\w.-]+|npm run|make)\b/;
const hasLiteralCommand = commandish.test(fenced);
record('rollback-is-a-literal-command', hasLiteralCommand,
  `a runnable command appears in a code block=${hasLiteralCommand}`);

// It has to be reachable without deciding anything first. A command whose
// argument is "the last known good tag" has moved the hard part into a
// placeholder.
const unresolvedPlaceholder = /<(previous|last[- ]known[- ]good|good|old)[^>]*>|\$\{?PREVIOUS|LAST_GOOD/i.test(fenced);
const usesBuiltInHistory = /rollout\s+undo|helm\s+rollback|revert|--to-revision/i.test(fenced);
record('rollback-needs-no-lookup', hasLiteralCommand && (usesBuiltInHistory || !unresolvedPlaceholder),
  `relies on the platform's own history=${usesBuiltInHistory}; unresolved placeholder=${unresolvedPlaceholder}`);

// The defect is the human dependency. Naming a person as the recovery path is
// what has to go.
const namesAPerson = /\b(Priya|Tom)\b/i.test(release);
const asksInChat = /(ask in|ask on|post in|#[a-z-]*oncall|slack)/i.test(release);
record('no-person-as-the-rollback-path', !namesAPerson && !asksInChat,
  `names a colleague=${namesAPerson}; directs the reader to chat=${asksInChat}`);

// The old text said so explicitly. Leaving it in place while adding a command
// above it is a contradiction an operator has to resolve under pressure.
record('no-automated-rollback-claim-removed', !/there is no automated rollback/i.test(release),
  'the "there is no automated rollback" line must not survive');

// Rule 4 also asks what a rollback does NOT cover. The config map is named in
// the original as an afterthought; a real procedure states its limits.
const namesLimits = /(config\s?map|configuration|schema|migration|database)/i.test(release)
  && /(not|does not|cannot|separate|manual|first|before)/i.test(release);
record('rollback-limits-stated', namesLimits,
  `says what the rollback does not restore=${namesLimits}`);

// Deployment still has to work; deleting deploy.sh satisfies nothing.
record('deploy-path-intact', /kubectl|rollout/.test(readIf('scripts/deploy.sh')),
  'scripts/deploy.sh must still deploy');
record('app-unchanged', /createApp/.test(readIf('src/server.js')),
  'src/server.js must keep its exported createApp');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'rollback-by-recollection', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
