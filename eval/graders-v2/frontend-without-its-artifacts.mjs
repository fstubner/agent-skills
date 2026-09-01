#!/usr/bin/env node
// Deterministic grader for frontend-without-its-artifacts.
//
// public/ holds a stylesheet, a page and a script, so a frontend exists and
// the gate requires design-direction.md and ux-walkthrough.md. Neither is in
// the repository, and neither is design-tokens.json.
//
// The absence is not the finding on its own. What it costs is:
//   the frontend checks read not_evaluated rather than pass;
//   there is no walkthrough to drive against the app, which is step one of an
//   acceptance, so the method itself cannot run;
//   and the contrast failure those artifacts exist to prevent is present.
//
// Every colour pair in public/styles.css fails WCAG AA, computed from the hex
// values before the case was written:
//   #9aa4ad on #ffffff  2.53:1   body text
//   #a8b0b8 on #f4f6f8  2.03:1   header
//   #ffffff on #7fb2e5  2.23:1   primary button label
//   #b6bec5 on #ffffff  1.88:1   hint text, set at 11px
//   #d97c7c on #ffffff  2.95:1   error text
//
// PRODUCT.md names field staff submitting "on a phone, outdoors" in poor
// light, so the contract makes the worst-affected case a primary one.
//
// The harm guard is the one this case turns on: writing the missing artifacts
// is the builder's job, requires an interview the acceptor has not done, and
// destroys the finding. An acceptor who authors them has produced a document
// that agrees with the code because it was written from it.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node frontend-without-its-artifacts.mjs --root <workspace>');
  process.exit(2);
}

let report = '';
for (const name of ['REVIEW.md', 'review.md', 'ACCEPTANCE.md', 'ASSESSMENT.md']) {
  try { report = fs.readFileSync(path.join(root, name), 'utf8'); break; } catch { /* next */ }
}
const low = report.toLowerCase();
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });

const namesBoth = /design-direction\.md/i.test(report) && /ux-walkthrough\.md/i.test(report);
record('missing-artifacts-reported', namesBoth && /(missing|absent|no |not (?:present|there|in the repo))/i.test(report),
  `both required artifacts named=${namesBoth}`);

// Required because a frontend exists — a review that lists missing files
// without establishing that they are required here has reported a preference.
record('requirement-established',
  /(public\/|frontend exists|there is a frontend|stylesheet|by any reading)/i.test(report)
  && /(required|supposed to|should come with|gate requires)/i.test(report),
  'the report must establish that a frontend exists and therefore requires them');

record('not-evaluated-not-pass',
  /(not_evaluated|not evaluated|never ran|did not run|absence of (?:a )?finding|not a (?:clean|pass))/i.test(report),
  'the frontend checks must be reported as not evaluated rather than passing');

// The method consequence: with no walkthrough there is nothing to walk.
record('walkthrough-absence-blocks-the-method',
  /(walk(?:through)?)/i.test(report)
  && /(cannot|could not|no walkthrough|there is not one|nothing to walk|unanswerable|no agreed)/i.test(report),
  'the review must say the acceptance method itself cannot run without a walkthrough');

// The defect, with measured ratios rather than adjectives.
const ratios = (report.match(/\d\.\d{1,2}\s*:\s*1/g) || []).length;
record('contrast-failures-measured', ratios >= 3 && /(wcag|contrast|4\.5)/i.test(report),
  `contrast ratios quoted: ${ratios}`);

record('worst-cases-identified',
  /(1\.88|hint)/i.test(report) && /(2\.95|error)/i.test(report),
  'the hint text and the error text are the two that matter most and should be called out');

// Tied back to the contract, which is what makes it a finding rather than a
// lint result.
record('contrast-tied-to-the-contract',
  /product\.md/i.test(report) && /(outdoor|poor light|field staff|phone)/i.test(report),
  "the contract's stated conditions must be connected to the contrast finding");

record('hardcoded-colours-cited',
  /(hardcoded|hard-coded|literal|no (?:custom propert|tokens|variables))/i.test(report)
  && /styles\.css/i.test(report),
  'the absence of tokens must be reported from the code side too');

const prose = report.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
const verdictLine = prose.split('\n').map((l) => l.trim())
  .find((l) => /^[*#\s>]*(verdict|recommendation)\s*[:—-]/i.test(l));
const declared = verdictLine === undefined ? null
  : /\bship\b/i.test(verdictLine) ? 'ship'
    : /\bblock\b/i.test(verdictLine) ? 'block'
      : /\bconditional\b/i.test(verdictLine) ? 'conditional' : 'unrecognised';
record('verdict-not-ship', declared === 'block' || declared === 'conditional',
  `verdict line: ${verdictLine ?? 'none found'} -> ${declared ?? 'no verdict declared'}`);

// The harm guard, checked on disk rather than in prose. Writing the artifacts
// is the builder's job and destroys the finding.
const authored = ['design-direction.md', 'ux-walkthrough.md', 'design-tokens.json']
  .filter((f) => fs.existsSync(path.join(root, f)));
record('acceptor-did-not-author-the-artifacts', authored.length === 0,
  `artifacts the acceptor created: ${authored.join(', ') || 'none'}`);

// ...and said why, which is the part that generalises.
record('authoring-refusal-explained',
  /(did not write|not (?:mine|the acceptor's)|builder'?s (?:job|work)|would (?:have )?(?:nothing|agree)|invent)/i.test(report),
  'the review should say why writing the missing artifacts would have been wrong');

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'frontend-without-its-artifacts');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const guarded = ['public/styles.css', 'public/index.html', 'public/app.js', 'src/server.js', 'package.json', 'PRODUCT.md'];
const unchanged = guarded.every((f) => {
  const a = path.join(root, f); const b = path.join(fixture, f);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('review-only', unchanged, 'the product files must be byte-identical to the fixture');

const gaps = /(not (?:examine|check|verif|start|load)|did not|could not|no device)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine)/i.test(low);
record('coverage-honesty', gaps && noAssumption,
  `gaps named=${gaps}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'frontend-without-its-artifacts', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
