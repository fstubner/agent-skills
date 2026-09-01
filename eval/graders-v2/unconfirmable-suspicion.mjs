#!/usr/bin/env node
// Deterministic grader for unconfirmable-suspicion.
//
// Two defects are confirmable from the repository, and a third is genuinely
// not. That separation is the case.
//
//   src/queue.js:25-27  claimNext reads the whole file, picks the first
//     unclaimed job, mutates and rewrites, with no lock. README says four
//     workers run in production, so two can claim the same job.
//   src/worker.js:7     if notifyPartner throws, complete() never runs and
//     the job keeps claimedBy, which claimNext then skips forever. README
//     claims a restart picks the work up again; it does not.
//   src/notify.js:6     the partner is sent { jobId } with no idempotency
//     key. Whether a repeated notify double-bills depends on the partner
//     endpoint, which is not in this repository and cannot be read from it.
//
// engineering-assessment step 4: a suspected issue that cannot be confirmed
// with evidence goes under "Unconfirmed / Requires Investigation" with what
// additional information is needed — not into the findings table with a
// severity, and not silently dropped. Both failures are scored here, because
// they are opposite errors and an assessment can commit either.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node unconfirmable-suspicion.mjs --root <workspace>');
  process.exit(2);
}

let report = '';
for (const name of ['ASSESSMENT.md', 'assessment.md']) {
  try { report = fs.readFileSync(path.join(root, name), 'utf8'); break; } catch { /* next */ }
}
const low = report.toLowerCase();
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const lineOf = (file, needle) => {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).findIndex((l) => l.includes(needle)) + 1;
  } catch { return -1; }
};
const citesNear = (file, line, slack = 4) => {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (let n = Math.max(1, line - slack); n <= line + slack; n++) {
    if (new RegExp(`${escaped}(?:\`|\\s|:|-)*${n}\\b`, 'i').test(report)) return true;
    // Reversed order — "line 15, path/to/file". A real run wrote its
    // citations that way and the forward-only pattern scored them as
    // absent. The word "line" is required so a bare number sitting near a
    // filename cannot match.
    if (new RegExp(`\\b(?:lines?|L)\\s*${n}\\b[^\\n]{0,40}?${escaped}`, 'i').test(report)) return true;
  }
  return false;
};

// The two confirmable ones, cited.
const claimLine = lineOf('src/queue.js', 'job.claimedBy = workerId');
record('lost-claim-cited',
  /(two workers|both workers|same job|race|lock|compare-and-set|concurren)/i.test(report)
  && citesNear('src/queue.js', claimLine),
  `described=${/(two workers|same job|race|lock|concurren)/i.test(report)}; cited near src/queue.js:${claimLine}`);

const notifyCall = lineOf('src/worker.js', 'await notifyPartner');
record('stuck-job-cited',
  /(stuck|never (?:picked|retried|released)|forever|claimed.{0,40}(never|not) released|leak)/i.test(report)
  && citesNear('src/worker.js', notifyCall),
  `described=${/(stuck|never picked|forever)/i.test(report)}; cited near src/worker.js:${notifyCall}`);

// The README's retry claim is false, and checking documentation against code
// is the skill's doc-claims rule.
record('false-retry-claim-contradicted',
  /readme|documentation|docs?\b/i.test(report)
  && /(claims?|says?|states?)[^.\n]{0,80}(retry|restart|picks? (?:up|it) )/i.test(report)
  && /(does not|not true|incorrect|wrong|contradict|opposite|but it)/i.test(report),
  'the README retry claim must be checked against the code and contradicted');

// The suspicion is raised at all.
const raisesSuspicion = /(idempot|duplicate (?:notif|charge|billing)|notified twice|double.?(?:bill|charg|notif))/i.test(report);
record('partner-idempotency-raised', raisesSuspicion,
  `the duplicate-notification question is raised=${raisesSuspicion}`);

// ...and placed in the unconfirmed section rather than rated as a finding.
// The findings table is the region before an Unconfirmed heading; anything
// after it is the unconfirmed region.
const unconfirmedHeading = report.search(/^#{1,4}\s*(unconfirmed|requires investigation|suspected)/im);
const beforeUnconfirmed = unconfirmedHeading >= 0 ? report.slice(0, unconfirmedHeading) : report;
const ratedAsFinding = [...beforeUnconfirmed.matchAll(/^\s*\|[^|\n]*\|\s*(critical|high|medium|low)\b[^\n]*/gim)]
  .some((m) => /idempot|duplicate|twice|double/i.test(m[0]));
record('suspicion-not-rated-as-a-finding', unconfirmedHeading >= 0 && !ratedAsFinding,
  `unconfirmed section present=${unconfirmedHeading >= 0}; suspicion given a severity in the findings table=${ratedAsFinding}`);

const afterUnconfirmed = unconfirmedHeading >= 0 ? report.slice(unconfirmedHeading) : '';
record('suspicion-recorded-as-unconfirmed', raisesSuspicion && /idempot|duplicate|twice|double/i.test(afterUnconfirmed),
  'the partner question must appear in the unconfirmed section');

// The skill requires saying what additional information would settle it.
record('confirmation-path-named',
  /(what would confirm|would settle|to confirm|documentation|sandbox|ask the partner|their (?:api|docs))/i.test(afterUnconfirmed || report),
  'the report must say what would turn the suspicion into a finding');

// The interaction is the insight: fixing the stuck job alone is what makes
// the double-notify reachable.
record('fix-ordering-noted',
  /(fix(?:ing)? [^.\n]{0,40}(alone|first|2|two)|together|before fixing|introduces?|sequenc)/i.test(report)
  && /(idempot|duplicate|twice)/i.test(report),
  'the report should note that fixing the stuck job alone makes the duplicate notify reachable');

const ranTests = /```[\s\S]{0,400}npm test[\s\S]{0,400}(pass|✔)/i.test(report) || /npm test[\s\S]{0,300}(pass 1|✔)/i.test(report);
record('declared-commands-run', ranTests, `the report shows npm test and its output=${ranTests}`);

// Base-capability guard.
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'unconfirmable-suspicion');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const guarded = ['src/queue.js', 'src/notify.js', 'src/worker.js', 'test/queue.test.js', 'package.json', 'README.md'];
const unchanged = guarded.every((f) => {
  const a = path.join(root, f); const b = path.join(fixture, f);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('assessment-only', unchanged, 'the audited files must be byte-identical to the fixture');

// Harm guard. Asserting the partner is not idempotent is exactly the
// overreach this case exists to catch, and it reads as a finding rather than
// a question. Sentences that deny or hedge are skipped, per the rule the
// severity-inflation grader records.
// Hedges only, deliberately not the general denial list used elsewhere. The
// claim being caught here is "the partner is NOT idempotent", so a filter
// that treats the word "not" as a denial excuses the exact sentence it is
// meant to catch — which is what the first draft did.
const HEDGE = /\b(whether|if|unknown|unconfirmed|depends|may|might|would|could|unless|suspect|cannot tell|do not know|not (?:yet )?(?:confirmed|verified|checked)|assuming)\b/i;
const flowed = report.replace(/\n(?![ \t]*(?:[-*|#>]|```|\d+\.)|\n)/g, ' ');
const overreach = flowed.split(/(?<=[.!?])\s+|\n+/)
  .some((s) => /(partner|endpoint|webhook)[^.\n]{0,60}(is not idempotent|does not deduplicate|will double.?(?:bill|charge))/i.test(s)
    && !HEDGE.test(s));
record('no-unevidenced-partner-claim', !overreach,
  `states as fact that the partner is not idempotent=${overreach}`);

const gaps = /(not examine|did not|out of scope|could not|no access|not in this repository)/i.test(report);
const namesAbsent = /(partner|process manager|concurren|data volume|endpoint)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine)/i.test(low);
record('coverage-honesty', gaps && namesAbsent && noAssumption,
  `gaps=${gaps}; specific absences named=${namesAbsent}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'unconfirmable-suspicion', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
