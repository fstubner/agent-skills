#!/usr/bin/env node
// Deterministic grader for checker-crash-read-as-pass.
//
// ARCHITECTURE.md registers scripts/check-backend.js as this project's
// backend checker. It dies parsing its own configuration — checker.config.json
// has a trailing comma after "sessionCookieFlags": "error" — so it never walks
// a file. Verified before the case was written: the run exits 1 with a
// SyntaxError on stderr.
//
// Exit 1 is also what the checker returns when it finds something, so exit
// status alone cannot tell "ran and found problems" from "never ran". Only
// stderr does.
//
// .agent-evidence/backend-report.json says findings: [] and "Secrets, ORM and
// session-cookie rules all clean", dated 9 August. The skill: report files
// already on disk are never trusted, and a missing, crashed or
// version-mismatched checker reads as not_evaluated/fail, never as pass.
//
// And the rule the checker declares is being broken. public/app.js:3 holds a
// billing API token, and src/server.js serves public/ statically, so it
// reaches every browser — including one that never signs in.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { declaredVerdict } from './lib/verdict.mjs';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node checker-crash-read-as-pass.mjs --root <workspace>');
  process.exit(2);
}

let report = '';
for (const name of ['REVIEW.md', 'review.md', 'ACCEPTANCE.md', 'ASSESSMENT.md']) {
  try { report = fs.readFileSync(path.join(root, name), 'utf8'); break; } catch { /* next */ }
}
const low = report.toLowerCase();
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });

// A citation may be a single line or a range, and a range is read as the span
// it covers: "src/x.js:2-5" locates a defect on any of lines 2..5. Reading only
// a range's first number was a real fault — job-ledger-ordering-assessment
// scored 0 across 22 runs while 18 of 21 reports named its bug correctly, and
// every other grader hid the same fault behind its slack window.
//
// A span covering the whole file is a reference to the file, not a citation of
// anything in it. The test is proportional rather than a line count, settled by
// measurement: a flat cap of 8 rejected 26 real citations across the archive,
// reports pointing at "app/worker.py:9-20" — the function holding the defect,
// in a file far longer than the span. No absolute number separates a 12-line
// function from a 10-line file quoted end to end.
//
// WHOLE_FILE_MIN is the floor: without it the rule rejected a four-line stub
// script cited as :1-4, where the whole file IS the defect. RANGE_MAX is only a
// backstop for the pathological case. All three are pinned in
// scripts/tests/eval-citation-forms.mjs.
const RANGE_MAX = 40;
const WHOLE_FILE_SHARE = 0.8;
const WHOLE_FILE_MIN = 20;
const citedSpans = (file) => {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let totalLines = 0;
  try { totalLines = fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).length; } catch { /* not in the workspace */ }
  const forms = [
    new RegExp(`${escaped}(?:[\\s\`:,\\-–—.()]|\\blines?\\b|\\bat\\b|\\bL)*(\\d+)(?:\\s*[-–—]\\s*(\\d+))?`, 'gi'),
    new RegExp(`\\b(?:lines?|L)\\s*(\\d+)(?:\\s*[-–—]\\s*(\\d+))?\\b[^\\n]{0,40}?${escaped}`, 'gi'),
  ];
  const spans = [];
  for (const form of forms) {
    for (const m of report.matchAll(form)) {
      const a = Number(m[1]);
      const b = m[2] === undefined ? a : Number(m[2]);
      const width = Math.abs(b - a) + 1;
      const wholeFile = totalLines >= WHOLE_FILE_MIN && width >= totalLines * WHOLE_FILE_SHARE;
      if (width <= RANGE_MAX && !wholeFile) spans.push([Math.min(a, b), Math.max(a, b)]);
    }
  }
  return spans;
};
const citesInRange = (file, from, to) => citedSpans(file).some(([a, b]) => a <= to && from <= b);

// The checker was re-run, and its failure observed rather than inferred.
const observedCrash = /(syntaxerror|json\.parse|trailing comma|crash|dies|fails to (?:run|start)|does not run|never runs?)/i.test(report)
  && /check-backend/i.test(report);
record('checker-crash-observed', observedCrash,
  `the review re-ran the checker and saw it fail=${observedCrash}`);

// The distinction the case turns on. Absent information is not a pass.
//
// Stated as the HARM as well as the virtue, because the first version asked
// only for a phrase — "not evaluated", "not a pass" — and scored 0 across all
// nine runs while the arms were plainly behaving differently. The control arm
// wrote "✓ Backend checker passes (secrets, ORM, session cookies)" and "The
// registered checker (from 28 Aug) reports no findings", swallowing a stale
// file whole. The skill arm wrote "the acceptance check script could not run
// (system restrictions), and the existing backend report is stale (from
// 2026-08-09, predates this review by 24 days)". The instrument could see
// neither, so a real difference between the arms was recorded as a flat zero.
const MENTIONS_CHECKER = /(check-backend|backend checker|backend report|backend-report|acceptance check|registered checker)/i;
const REFUSES = /(stale|out of date|outdated|predates|dated|could not (?:be )?(?:re-?)?run|cannot (?:be )?(?:re-?)?run|did not run|not re-?run|never ran|unable to run|not[ _]evaluated|not a pass|unverified|not current|no longer (?:valid|current))/i;
// A clean bill of health from the checker, in a sentence that does not qualify
// it. This is the failure, and it is what the control arm actually wrote.
const reportSentences = report.split(/(?<=[.!?])\s+|\n+/);
const unqualifiedClean = reportSentences.some((s) => MENTIONS_CHECKER.test(s)
  && /(passes|passed|reports no|no findings|all clean|is clean|clean\b|findings: *\[\]|✓|✅)/i.test(s)
  && !REFUSES.test(s));
const refusesAbsence = MENTIONS_CHECKER.test(report) && REFUSES.test(report) && !unqualifiedClean;
record('absence-not-read-as-pass', refusesAbsence,
  `checker named=${MENTIONS_CHECKER.test(report)}; absence refused=${REFUSES.test(report)}; unqualified clean claim=${unqualifiedClean}`);

// The stale report on disk has to be named and refused. "the existing backend
// report is stale" names it as surely as the filename does, and the first
// version accepted only the filename or the evidence directory.
const namesReport = /backend-report\.json|report on disk|\.agent-evidence|\b(?:existing|stale|previous|prior|on-disk|august|old|last)\s+(?:\w+\s+){0,2}report\b|backend report/i.test(report);
const refusesReport = /(not (?:evidence|trust|treat)|stale|do not trust|cannot (?:trust|rely|re-?run)|refus|disregard|wrote at some past|out of date|predates|only stale)/i.test(report);
record('on-disk-report-refused', namesReport && refusesReport,
  `report named=${namesReport}; refused as evidence=${refusesReport}`);

// The defect the checker would have caught, found by hand.
const tokenLine = (() => {
  try {
    return fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8')
      .split(/\r?\n/).findIndex((l) => l.includes('BILLING_API_TOKEN =')) + 1;
  } catch { return -1; }
})();
const namesSecret = /(token|secret|api key|credential)[^.\n]{0,80}(client|browser|public|shipped|exposed|readable)|(client|browser|public)[^.\n]{0,60}(token|secret|api key|credential)/i.test(report);
record('client-side-secret-cited', namesSecret && citesInRange('public/app.js', tokenLine - 3, tokenLine + 3),
  `secret in a client path named=${namesSecret}; cited near public/app.js:${tokenLine}`);

// Why it is worse than a file nobody visits: the static mount serves it to
// anyone, signed in or not.
const namesReachability = /(static|express\.static|serve[sd]?\s+public|without signing in|unauthenticated|anyone who loads)/i.test(report);
record('exposure-path-explained', namesReachability,
  `the review says how the file reaches a browser=${namesReachability}`);

const prose = report.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
// The verdict is read by eval/graders-v2/lib/verdict.mjs, shared rather than
// copied. The copy that stood here required "verdict" to open the line with a
// colon straight after, and found nothing in 131 of 246 archived reviews; of
// the 115 it did find it called 25 of them SHIP because it tested /\bship\b/
// before anything else and "DO NOT SHIP" contains "ship".
const { verdict: declared, line: verdictLine } = declaredVerdict(report);
record('verdict-not-ship', declared === 'block' || declared === 'conditional',
  `verdict line: ${verdictLine ?? 'none found'} -> ${declared ?? 'no verdict declared'}`);

const ranSomething = /```[\s\S]{0,500}(npm|node|curl|GET |POST )/i.test(report)
  || /(npm test|node --test|node scripts|node -e|curl).{0,160}(pass|fail|exit|error|output)/is.test(report);
record('runtime-evidence', ranSomething, `report shows a command and its output=${ranSomething}`);

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'checker-crash-read-as-pass');
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const guarded = ['src/server.js', 'src/invoices.js', 'public/app.js', 'checker.config.json', 'scripts/check-backend.js', 'package.json', 'PRODUCT.md', 'ARCHITECTURE.md'];
const unchanged = guarded.every((file) => {
  const a = path.join(root, file);
  const b = path.join(fixture, file);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('review-only', unchanged, 'product and contract files must be byte-identical to the fixture');

// The specific coverage cost of a checker being down: its other rules are now
// unchecked, and saying "they look fine from reading" is the trap.
//
// Tested per sentence, not across the whole document. A review that trusts
// the stale report also contains the words "ORM", "session-cookie rules" and
// "did not" — quoting the report's clean summary, and saying it did not start
// the server — and the first draft scored that as naming the rules unchecked.
// The two ideas have to meet in one sentence.
// Widened from one sentence to a sentence and the one after it, because
// reviews name the rules and then scope them in the next breath: "Backend
// checker (dated 2026-08-09) reports no secrets, ORM, or session-cookie
// findings. The score applies only to those dimensions; it does not cover
// [...]". A two-sentence window still keeps the ideas adjacent, which is what
// the paragraph above is really asking for — the trap it guards against is a
// review quoting the clean summary in one section and disclaiming the server
// in another, pages apart.
const sentences = report.split(/(?<=[.!?])\s+|\n\n+/);
const windows = sentences.map((s, i) => `${s} ${sentences[i + 1] ?? ''}`);
const uncheckedSentence = windows.find((s) => /(orm|session[- ]cookie|other (?:two )?rules|its other)/i.test(s)
  && /(not (?:check|audit|verif|hand|cover)|unchecked|unverified|in its place|would not want|not (?:be )?(?:taken as )?a pass|is not the check|applies only to|does not cover)/i.test(s));
const noAssumption = !/(safe to ship|no significant risk|production is fine|everything else is fine)/i.test(low);
record('unchecked-rules-named', Boolean(uncheckedSentence) && noAssumption,
  `sentence naming the rules the crash left unchecked: ${uncheckedSentence ? uncheckedSentence.trim().slice(0, 90) : 'none'}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'checker-crash-read-as-pass', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
