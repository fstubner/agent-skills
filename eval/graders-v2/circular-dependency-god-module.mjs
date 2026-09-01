#!/usr/bin/env node
// Deterministic grader for circular-dependency-god-module.
//
// src/util.js imports ./pricing.js and ./customers.js, and both import
// ./util.js back. Two cycles, and this suite's own code-organization checker
// reports them: verdict BLOCK, O-circular-deps fail. Verified before the case
// was written.
//
// The cycles are a symptom. util.js exports seven functions with no shared
// subject — money formatting, order description, slugs, date parsing,
// chunking, retry — and describeOrder is the only reason it imports anything
// at all. Moving that one function removes both cycles.
//
// engineering-assessment step 2: where this suite's own checkers apply, run
// them and cite their JSON reports as evidence rather than re-deriving what
// they measure. This is the case where one applies and fails, so an
// assessment that reasons about coupling without running it has skipped the
// cheapest evidence available — the same failure step 0 exists for.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node circular-dependency-god-module.mjs --root <workspace>');
  process.exit(2);
}

let report = '';
for (const name of ['ASSESSMENT.md', 'assessment.md']) {
  try { report = fs.readFileSync(path.join(root, name), 'utf8'); break; } catch { /* next */ }
}
const low = report.toLowerCase();
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });

// The checker was run and its own output quoted, not paraphrased. Its check
// id and verdict are strings nothing else in the repository contains.
const namesChecker = /check-organization/i.test(report);
const quotesResult = /O-circular-deps/i.test(report) && /\bBLOCK\b/.test(report);
record('suite-checker-run-and-cited', namesChecker && quotesResult,
  `checker named=${namesChecker}; its check id and verdict quoted=${quotesResult}`);

// Both cycles, with the files that form them. Naming "a circular dependency"
// without the edges is not evidence.
const namesCycle = /(circular|cycle|imports? (?:each other|back)|mutual)/i.test(report);
const edges = ['util.js', 'pricing.js', 'customers.js'].filter((f) => new RegExp(f.replace('.', '\\.'), 'i').test(report)).length;
record('cycles-traced-through-their-files', namesCycle && edges === 3,
  `cycle named=${namesCycle}; files in the cycles named: ${edges} of 3`);

// The grab-bag, described as a cohesion problem rather than a size one.
const namesGrabBag = /(grab.?bag|kitchen sink|god (?:module|object)|unrelated|no shared (?:subject|purpose)|does too much|catch.?all|miscellaneous)/i.test(report);
record('god-module-cited', namesGrabBag && /util\.js/i.test(report),
  `described=${namesGrabBag}; util.js named=${/util\.js/i.test(report)}`);

// The insight that makes the fix cheap: one function is the whole cause.
record('root-cause-isolated',
  /describeOrder/i.test(report)
  && /(only reason|symptom|removes? both|moving (?:that|this) one|side effect)/i.test(report),
  'the report should identify describeOrder as the single import that creates both cycles');

// The README argues from usage; the finding is about cohesion. An assessment
// that accepts "everything is used" as an answer has taken the wrong test.
record('readme-argument-addressed',
  /readme|nothing to remove|everything (?:in it )?is used/i.test(report)
  && /(beside the point|not the (?:point|criterion|question)|cohesion|unrelated|is not about (?:dead|removal))/i.test(report),
  "the README's everything-is-used argument must be answered on cohesion grounds");

const ranTests = /```[\s\S]{0,400}npm test[\s\S]{0,400}(pass|✔)/i.test(report) || /npm test[\s\S]{0,300}(pass 2|✔)/i.test(report);
record('declared-commands-run', ranTests, `the report shows npm test and its output=${ranTests}`);

// Harm guard. ES module cycles often resolve fine depending on what is read
// at evaluation time, and nothing here reads an import at the top level. An
// assessment that asserts this crashes or fails to load today has predicted a
// runtime it did not observe.
const flowed = report.replace(/\n(?![ \t]*(?:[-*|#>]|```|\d+\.)|\n)/g, ' ');
const HEDGE = /\b(may|might|could|would|suspect|if|whether|not (?:construct|observed|tested)|unconfirmed|depends|probably|works today)\b/i;
const assertsCrash = flowed.split(/(?<=[.!?])\s+|\n+/)
  .some((s) => /(cycle|circular|util\.js)/i.test(s)
    && /(crashes|throws|fails to load|undefined at import|breaks at runtime|will fail)/i.test(s)
    && !HEDGE.test(s));
record('no-unobserved-runtime-claim', !assertsCrash,
  `asserts the cycle breaks at runtime without having observed it=${assertsCrash}`);

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'circular-dependency-god-module');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const guarded = ['src/util.js', 'src/pricing.js', 'src/customers.js', 'package.json', 'README.md'];
const unchanged = guarded.every((f) => {
  const a = path.join(root, f); const b = path.join(fixture, f);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('assessment-only', unchanged, 'the audited files must be byte-identical to the fixture');

const gaps = /(not examine|did not|out of scope|could not|cannot see|consumers)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine)/i.test(low);
record('coverage-honesty', gaps && noAssumption,
  `gaps named=${gaps}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'circular-dependency-god-module', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
