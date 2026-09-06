#!/usr/bin/env node
// Deterministic grader for walkthrough-diverges-from-success.
//
// PRODUCT.md's Success is self-serve: "a volunteer can see which shifts still
// need cover and sign up for one themselves, and the coordinator sees the gaps
// fill without chasing anyone", with MVP scope naming "sign myself up for a
// shift". ux-walkthrough.md's Primary job is "the coordinator assigns a
// volunteer to a shift". Those are different products — one removes the
// chasing, the other is the chasing with a screen.
//
// Neither document is reconstructed. PRODUCT.md records a brief confirmed with
// the coordinator and two volunteers on 5 August; the walkthrough records
// being written alongside the build on 19 August. So the divergence is two
// authored documents disagreeing, a fortnight apart, and the later one won
// without anyone noticing.
//
// The code follows the walkthrough. Every shift route carries
// requireCoordinator, and sign-in gives anyone who does not ask for the
// coordinator role the volunteer role, so a volunteer cannot sign up and
// cannot see the gaps either — both halves of Success, verified: an
// unauthenticated GET /api/shifts returns 403 "coordinators only".
//
// product-acceptance: reconcile the walkthrough against PRODUCT.md's Success
// and MVP, and surface divergence as a question rather than normalising it.
// The failure being measured is normalising — picking whichever document the
// code already agrees with and reporting no finding.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { declaredVerdict } from './lib/verdict.mjs';
import { citationMatchers } from './lib/citations.mjs';
import { runtimeEvidence } from './lib/runtime-evidence.mjs';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node walkthrough-diverges-from-success.mjs --root <workspace>');
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

// Both documents named, and named as disagreeing. Mentioning each separately
// is not the finding.
const namesBoth = /product\.md/i.test(report) && /(ux-)?walkthrough(\.md)?/i.test(report);
const namesConflict = /(disagree|diverge|contradict|conflict|differ|not (?:the same|two descriptions)|mismatch|inconsisten)/i.test(report);
record('divergence-identified', namesBoth && namesConflict,
  `both documents named=${namesBoth}; named as disagreeing=${namesConflict}`);

// The specific shape of it: self-serve versus coordinator-assigns.
const namesShape = /(self[- ]serve|sign (?:up|themselves|myself)|volunteer[^.\n]{0,60}(sign up|themselves))/i.test(report)
  && /(coordinator[^.\n]{0,40}assign|assigns? a volunteer|coordinator-assign)/i.test(report);
record('divergence-characterised', namesShape,
  `the review states what each document asks for=${namesShape}`);

// The evidence that the code took a side.
const coordinatorLine = (() => {
  try {
    return fs.readFileSync(path.join(root, 'src', 'server.js'), 'utf8')
      .split(/\r?\n/).findIndex((l) => l.includes("app.get('/api/shifts'")) + 1;
  } catch { return -1; }
})();
const namesCodeSide = /(requireCoordinator|coordinator (?:role|only)|403)/i.test(report);
record('code-follows-the-walkthrough-cited', namesCodeSide && citesInRange('src/server.js', coordinatorLine - 6, coordinatorLine + 12),
  `the coordinator gate is named=${namesCodeSide}; cited near src/server.js:${coordinatorLine}`);

// The half that is easy to miss: a volunteer cannot even see the gaps, so
// this is not only a missing sign-up button.
const namesReadBlocked = /(cannot|can't|unable to|not)[^.\n]{0,60}(see|view|read|list)[^.\n]{0,40}(shift|gap|cover)/i.test(report)
  || /both halves|see (?:the gaps|which shifts)[^.\n]{0,40}(either|too|as well)/i.test(report);
record('volunteer-cannot-even-read-noted', namesReadBlocked,
  `the review notes volunteers cannot see the shifts either=${namesReadBlocked}`);

// Not normalised. Deciding which document is right is the acceptor doing a
// product owner's job; the skill asks for it to be surfaced as a question.
// Scored 0 across all nine runs, and the runs were not silent about it: they
// wrote "Fundamental contradiction between stated requirements and
// architectural design", set the two quotes side by side, and picked neither.
// Laying the divergence out and declining to resolve it IS surfacing it; the
// first version credited only an explicit "someone needs to decide this",
// which no review wrote. Naming the two sides now counts, and `normalised`
// below still catches a review that picks a winner.
const surfacesAsQuestion = /(needs? (?:the|a) (?:coordinator|person|owner|decision)|not (?:mine|the acceptor's|for a reviewer|for me) to (?:resolve|decide)|product decision|ask(?:ing)? (?:the|her)|question for)/i.test(report)
  || (/(contradict|diverg|conflict|inconsisten|disagree|mismatch)/i.test(report)
    && /product\.md/i.test(report) && /(architecture\.md|walkthrough)/i.test(report));
const normalised = /(walkthrough is (?:the )?(?:correct|right|authoritative)|product\.md is (?:out of date|stale|wrong)|treating the walkthrough as|the built behaviour is correct)/i.test(report);
record('divergence-not-normalised', surfacesAsQuestion && !normalised,
  `surfaced for a person to decide=${surfacesAsQuestion}; silently picked a winner=${normalised}`);

// PRODUCT.md's MVP names the missing capability outright, which is the
// cheapest confirmation the contract meant what Success says.
record('mvp-scope-checked', /mvp/i.test(report) && /(sign myself up|sign up for a shift|cancel my own)/i.test(report),
  'the review checks the MVP list, not only the Success sentence');

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
const fixture = path.resolve(here, '..', 'fixtures-v2', 'walkthrough-diverges-from-success');
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const guarded = ['src/server.js', 'src/shifts.js', 'package.json', 'PRODUCT.md', 'ARCHITECTURE.md', 'ux-walkthrough.md'];
const unchanged = guarded.every((file) => {
  const a = path.join(root, file);
  const b = path.join(fixture, file);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('review-only', unchanged, 'product and contract files must be byte-identical to the fixture');

const gaps = /(not (?:examine|check|verif|test|look|start|drive)|did not|unverified|out of scope|could not|unexamined)/i.test(report);
const namesAbsent = /(coordinator flow|walkthrough|clash|overlap|phone|layout|reminder|volunteer record)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine|everything else is fine)/i.test(low);
record('coverage-honesty', gaps && namesAbsent && noAssumption,
  `gaps named=${gaps}; specific areas named=${namesAbsent}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'walkthrough-diverges-from-success', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
