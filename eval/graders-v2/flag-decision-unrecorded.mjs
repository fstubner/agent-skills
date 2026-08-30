#!/usr/bin/env node
// Deterministic grader for flag-decision-unrecorded.
//
// Five flags, four of them on for over a year, none with an owner or a
// condition that would ever remove it; and a PR template with no place to
// record whether a change was flagged at all. So "was this deliberately
// unflagged" is unanswerable, and every flag is permanent branching.
//
// release-engineering rule 5: the decision gets recorded rather than assumed —
// `flagged: yes|no — <reason>` in the PR, and a flag that is on gets a removal
// condition at the same time.
//
// The grader never imports the fixture's code. Behaviour is checked textually
// against the boolean sitting beside each flag name, which is weaker than
// evaluating the module and is the trade this suite makes everywhere: a
// grader that executes what an agent wrote is a grader that runs arbitrary
// code.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node flag-decision-unrecorded.mjs --root <workspace>');
  process.exit(2);
}

const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const readIf = (rel) => {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
};

const flagsSrc = readIf('src/flags.js');
record('flags-module-present', /export\s+function\s+isEnabled/.test(flagsSrc),
  `src/flags.js still exports isEnabled=${/export\s+function\s+isEnabled/.test(flagsSrc)}`);

const FLAGS = {
  newLedgerWriter: 'true',
  batchedExports: 'true',
  legacyCurrencyRounding: 'false',
  fastEntryLookup: 'true',
  reconciliationV2: 'true',
};
const names = Object.keys(FLAGS);
const lines = flagsSrc.split('\n');
const lineOf = (name) => lines.findIndex((line) => new RegExp(`(^|[^A-Za-z])${name}\\s*:`).test(line));

// Deleting a flag is a behaviour change wearing the costume of a cleanup. The
// task was to record the decisions, not to make them.
const missing = names.filter((name) => lineOf(name) < 0);
record('all-flags-retained', missing.length === 0,
  `flags no longer declared: ${missing.join(',') || 'none'}`);

// Each flag's value must still read the same. Checked on the flag's own line
// and the line after it, so both `name: true` and an expanded object form
// count.
const flipped = names.filter((name) => {
  const at = lineOf(name);
  if (at < 0) return true;
  const window = lines.slice(at, at + 2).join(' ');
  return !new RegExp(`\\b${FLAGS[name]}\\b`).test(window);
});
record('flag-values-unchanged', flipped.length === 0,
  `flags whose value no longer reads as it did: ${flipped.join(',') || 'none'}`);

// An owner and a removal condition, searched in the six lines above each flag
// and the four below — comment block or object field, either is a record.
const REMOVAL = /remove\s?(when|by|after|-?condition)|retire|sunset|expires?|delete\s+when|until/i;
const OWNER = /owner|team|maintainer|@[a-z]/i;
const PLACEHOLDER = /\b(tbd|t\.b\.d|n\/a|none|unknown|\?\?\?)\b/i;

const windowFor = (name) => {
  const at = lineOf(name);
  return at < 0 ? '' : lines.slice(Math.max(0, at - 6), at + 5).join('\n');
};
const noRemoval = names.filter((name) => !REMOVAL.test(windowFor(name)));
record('every-flag-has-a-removal-condition', names.length > 0 && noRemoval.length === 0,
  `flags with no removal condition: ${noRemoval.join(',') || 'none'}`);

const noOwner = names.filter((name) => !OWNER.test(windowFor(name)));
record('every-flag-has-an-owner', names.length > 0 && noOwner.length === 0,
  `flags with no owning team: ${noOwner.join(',') || 'none'}`);

// "remove when: TBD" is the same permanent branch with a comment on it.
const placeholders = names.filter((name) => PLACEHOLDER.test(windowFor(name)));
record('removal-conditions-are-not-placeholders', placeholders.length === 0,
  `flags whose condition is a placeholder: ${placeholders.join(',') || 'none'}`);

const template = readIf('.github/pull_request_template.md')
  || readIf('.github/PULL_REQUEST_TEMPLATE.md')
  || readIf('docs/pull_request_template.md');
record('pr-template-present', template.trim().length > 0, `PR template bytes=${template.length}`);

// The decision has to be recorded for both answers. A template that only
// prompts when a flag was used leaves "we chose not to" invisible, which is
// the half that is arguable later.
const decisionLine = template.split('\n').find((line) => /flag/i.test(line) && /\byes\b/i.test(line) && /\bno\b/i.test(line));
record('pr-template-records-the-flag-decision', Boolean(decisionLine),
  `line prompting for a yes-or-no flag decision: ${decisionLine ? decisionLine.trim() : 'none'}`);

// And the reason, not just the answer.
const asksWhy = Boolean(decisionLine) && (/reason|why|because|—|--/.test(decisionLine) || /reason|why/i.test(template));
record('pr-template-asks-for-the-reason', asksWhy,
  `the template asks why, not only whether=${asksWhy}`);

record('app-unchanged', /createApp/.test(readIf('src/server.js')),
  'src/server.js must keep its exported createApp');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'flag-decision-unrecorded', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
