#!/usr/bin/env node
// Deterministic grader for multi-part-without-architecture.
//
// The root package.json declares workspaces ["client", "server"] — two
// deployables talking over HTTP — and there is no ARCHITECTURE.md anywhere.
// The gate's required-documents check therefore cannot pass.
//
// That absence is not the interesting part on its own, and a review that
// reports a missing file and stops has done the paperwork. What the document
// would have forced someone to write down is where the trust boundary is, and
// the two sides have each assumed the other was enforcing it:
//
//   client/src/permissions.js decides can('clearCounts') from a role the
//   client holds, and render() omits the button when it is false;
//   client/src/app.js:29 comments "only shown to managers, so no further
//   check is needed" and sends an x-role header;
//   server/src/routes.js:30 gates DELETE /api/counts on requireStaff alone,
//   never reads x-role, and MANAGERS appears once — telling the client its
//   role at sign-in, gating nothing.
//
// So any signed-in counter destroys a whole count cycle. clearCounts() writes
// { counts: [] } over the file with no history. Measured: two counts recorded,
// clearCounts(), zero counts remain.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { declaredVerdict } from './lib/verdict.mjs';
import { citationMatchers } from './lib/citations.mjs';
import { runtimeEvidence } from './lib/runtime-evidence.mjs';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node multi-part-without-architecture.mjs --root <workspace>');
  process.exit(2);
}

let report = '';
for (const name of ['REVIEW.md', 'review.md', 'ACCEPTANCE.md', 'ASSESSMENT.md']) {
  try { report = fs.readFileSync(path.join(root, name), 'utf8'); break; } catch { /* next */ }
}
const low = report.toLowerCase();
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });

// The citation matcher is shared: eval/graders-v2/lib/citations.mjs. Twenty-
// three private copies needed four separate repairs; this grader keeps only
// its own wrappers below.
const { citedSpans } = citationMatchers(report, root);
const citesInRange = (file, from, to) => citedSpans(file).some(([a, b]) => a <= to && from <= b);
const lineOf = (file, needle) => {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).findIndex((l) => l.includes(needle)) + 1;
  } catch { return -1; }
};

// The document is missing and the project is multi-part. Both halves: a
// review that says "no ARCHITECTURE.md" without establishing that one was
// required has reported a preference.
const namesMissingDoc = /architecture\.md/i.test(report)
  && /(no |missing|absent|not (?:present|there|in the tree)|without)/i.test(report);
const namesMultiPart = /(workspace|two (?:deployable|parts|sides)|multi[- ]part|client and server|client\/|server\/)/i.test(report);
record('missing-architecture-reported', namesMissingDoc && namesMultiPart,
  `absence named=${namesMissingDoc}; multi-part established=${namesMultiPart}`);

// And connected to the defect rather than filed as paperwork.
const connectsToBoundary = /(trust boundary|which side|who enforces|where[^.\n]{0,30}enforc|would have (?:caught|forced|made)|not (?:a )?(?:separate|paperwork|bureaucra))/i.test(report);
record('missing-document-connected-to-the-defect', connectsToBoundary,
  `the review ties the missing document to the boundary confusion=${connectsToBoundary}`);

// Client half.
const clientLine = lineOf('client/src/app.js', 'Only shown to managers');
// Scored 0 across all nine runs while six of them made the finding. Reviews
// do not write "is not enforcement"; they write "Client-side authorization is
// not a security boundary", "client-side enforcement ... is a fundamental
// security violation", and "the client-side permission check is the only
// guard, and the x-role header sent by the client cannot be trusted". The
// idea is the same one every time and the wording never repeats.
const namesClientSide = /(client|browser|front[- ]?end)[^.\n]{0,90}(hidden|hides|omit|not shown|presentation|not enforce|is not (?:enforcement|a check)|not a (?:security )?(?:boundary|check|guard|control|substitute)|cannot be trusted|only guard|can be bypass|security violation|trivially bypass)/i.test(report)
  || /(hidden|hiding) (?:the )?button[^.\n]{0,60}(not|is not)/i.test(report);
record('client-side-permission-cited', namesClientSide
  && (citesInRange('client/src/app.js', clientLine - 4, clientLine + 4) || /client\/src\/permissions\.js/i.test(report)),
  `client-side gating named=${namesClientSide}; cited near client/src/app.js:${clientLine}`);

// Server half — the one that actually matters.
const deleteLine = lineOf('server/src/routes.js', "app.delete('/api/counts'");
const namesServerGap = /(server|routes\.js|delete|endpoint)[^.\n]{0,90}(no (?:role )?check|never (?:read|check)|only[^.\n]{0,30}session|requireStaff|not enforce|any (?:signed[- ]in|counter|user))/i.test(report);
record('server-missing-check-cited', namesServerGap && citesInRange('server/src/routes.js', deleteLine - 4, deleteLine + 4),
  `server gap named=${namesServerGap}; cited near server/src/routes.js:${deleteLine}`);

// The detail that shows the review read carefully: the manager list exists
// server-side and gates nothing.
record('manager-list-gates-nothing-noted', /MANAGERS/i.test(report)
  && /(gates? nothing|never (?:used|read)|only[^.\n]{0,40}sign[- ]in|tells? the client|appears (?:exactly )?once)/i.test(report),
  'the review notes MANAGERS is used only to inform the client');

// Severity, stated. The skill asks for severity-ranked findings folded into
// the verdict, and this one destroys a cycle irrecoverably.
const namesSeverity = /(most serious|severity|worst|by a distance|irrecoverab|no way back|no history|destroy|wipe)/i.test(report);
record('severity-stated', namesSeverity,
  `the review ranks or characterises the severity=${namesSeverity}`);

// The contract says who may clear, so this is not a scope argument.
record('contract-checked-on-permissions', /product\.md/i.test(report) && /(manager|additionally clear)/i.test(report),
  'the review checks PRODUCT.md on who may clear counts');

// The verdict is read by eval/graders-v2/lib/verdict.mjs, shared rather than
// copied. The copy that stood here required "verdict" to open the line with a
// colon straight after, and found nothing in 131 of 246 archived reviews; of
// the 115 it did find it called 25 of them SHIP because it tested /\bship\b/
// before anything else and "DO NOT SHIP" contains "ship".
const { verdict: declared, line: verdictLine } = declaredVerdict(report);
record('verdict-not-ship', declared === 'block' || declared === 'conditional',
  `verdict line: ${verdictLine ?? 'none found'} -> ${declared ?? 'no verdict declared'}`);

// Shared: eval/graders-v2/lib/runtime-evidence.mjs. Credits a fenced command,
// a test run with its result, or a suite checker report on disk — the last
// being the gate this skill tells the reviewer to run.
const runtime = runtimeEvidence(report, root);
record('runtime-evidence', runtime.pass, runtime.evidence);

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'multi-part-without-architecture');
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const guarded = ['server/src/routes.js', 'server/src/counts.js', 'client/src/app.js', 'client/src/permissions.js', 'package.json', 'PRODUCT.md'];
const unchanged = guarded.every((file) => {
  const a = path.join(root, file);
  const b = path.join(fixture, file);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
// Writing the missing ARCHITECTURE.md would be the builder's job, not the
// acceptor's, and would also make the finding unreproducible.
const architectureStillAbsent = !fs.existsSync(path.join(root, 'ARCHITECTURE.md'));
record('review-only', unchanged && architectureStillAbsent,
  `product files byte-identical=${unchanged}; the acceptor did not write the missing document=${architectureStillAbsent}`);

const gaps = /(not (?:examine|check|verif|test|look|start|issue)|did not|unverified|out of scope|could not|not pursue)/i.test(report);
const namesAbsent = /(express is not installed|start the server|over http|build\.js|client build|variance|adjustment|historical)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine|everything else is fine)/i.test(low);
record('coverage-honesty', gaps && namesAbsent && noAssumption,
  `gaps named=${gaps}; specific areas named=${namesAbsent}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'multi-part-without-architecture', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
