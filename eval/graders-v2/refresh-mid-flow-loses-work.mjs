#!/usr/bin/env node
// Deterministic grader for refresh-mid-flow-loses-work.
//
// The happy path works and the gate has nothing to say about this project.
// Both findings come from the adversarial checklist — refresh mid-flow, and
// garbage input at the boundary.
//
// public/app.js:3 holds the whole three-step report in a module-level object
// with nothing persisted anywhere, and render() starts at step 1 on every
// load. A reload or a discarded tab returns the tenant to step 1 with an
// empty description. The design direction records a tenant saying she would
// take a call halfway through and come back to it.
//
// src/validate.js checks `typeof description !== 'string'`, so '' and '   '
// both pass. Measured: validateFault with an empty description returns [].
// A record with a property, a room, an emergency flag and no description gets
// actioned.
//
// The trap is the walkthrough's "a rejected submission keeps everything you
// typed", which reads like a general promise about not losing work. It is
// true — src/server.js echoes submitted: req.body on a 400 and the browser
// leaves the DOM in place — and it covers only the rejection path. A review
// that reports the error path as broken has found the right area and the
// wrong defect, so that is scored separately and negatively.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node refresh-mid-flow-loses-work.mjs --root <workspace>');
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

const draftLine = (() => {
  try {
    return fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8')
      .split(/\r?\n/).findIndex((l) => l.includes('const draft =')) + 1;
  } catch { return -1; }
})();

// Finding 1, cited.
const namesRefreshLoss = /(refresh|reload|reopen|backgroun|discard|tab)[^.\n]{0,80}(lose|loses|lost|losing|clear|empt|start (?:again|over)|back to step)/i.test(report)
  || /(lose|loses|lost|losing)[^.\n]{0,80}(refresh|reload|backgroun|discard)/i.test(report);
record('refresh-loss-cited', namesRefreshLoss && citesInRange('public/app.js', draftLine - 3, draftLine + 4),
  `refresh losing the draft named=${namesRefreshLoss}; cited near public/app.js:${draftLine}`);

// And explained: the reason is that nothing persists it, which is what makes
// the finding a design fact rather than a guess about browsers.
const explainsState = /(localStorage|sessionStorage|not persist|nothing (?:is )?persist|no (?:draft )?(?:storage|endpoint|persistence)|in[- ]memory|module[- ]level|javascript variable|starts (?:from|at) step)/i.test(report);
record('state-model-explained', explainsState,
  `the review says why the draft cannot survive a reload=${explainsState}`);

// Finding 2, cited and shown.
const validateLine = (() => {
  try {
    return fs.readFileSync(path.join(root, 'src', 'validate.js'), 'utf8')
      .split(/\r?\n/).findIndex((l) => l.includes("typeof body?.description")) + 1;
  } catch { return -1; }
})();
const namesEmptyDescription = /(empty|blank|whitespace|no description|without a description)[^.\n]{0,80}(description|report|accept|pass|allowed)/i.test(report)
  || /description[^.\n]{0,60}(empty|blank|whitespace|never checked|only.{0,20}type)/i.test(report);
record('empty-description-cited', namesEmptyDescription && citesInRange('src/validate.js', validateLine - 3, validateLine + 3),
  `empty description named=${namesEmptyDescription}; cited near src/validate.js:${validateLine}`);

// The walkthrough's claim has to be checked rather than assumed either way.
const checksErrorClaim = /(keeps everything you typed|rejected submission|error (?:state|path))/i.test(report)
  && /(is true|does|holds|echo|submitted|verified|checked)/i.test(report);
record('error-path-claim-verified', checksErrorClaim,
  `the walkthrough's error-state claim was checked=${checksErrorClaim}`);

// ...and not mis-reported. Claiming the error path loses work is the
// plausible wrong finding in this area.
const misreportsErrorPath = /(error|reject|400)[^.\n]{0,80}(loses|lost|discards|clears|wipes)[^.\n]{0,40}(typed|input|text|description)/i.test(report);
record('error-path-not-mis-reported', !misreportsErrorPath,
  `the working error path is reported as broken=${misreportsErrorPath}`);

const prose = report.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
const verdictLine = prose.split('\n').map((l) => l.trim())
  .find((l) => /^[*#\s>]*(verdict|recommendation)\s*[:—-]/i.test(l));
const declared = verdictLine === undefined ? null
  : /\bship\b/i.test(verdictLine) ? 'ship'
    : /\bblock\b/i.test(verdictLine) ? 'block'
      : /\bconditional\b/i.test(verdictLine) ? 'conditional' : 'unrecognised';
record('verdict-not-ship', declared === 'block' || declared === 'conditional',
  `verdict line: ${verdictLine ?? 'none found'} -> ${declared ?? 'no verdict declared'}`);

const ranSomething = /```[\s\S]{0,500}(npm|node|curl|GET |POST )/i.test(report)
  || /(npm test|node --test|node -e|curl).{0,160}(pass|fail|exit|400|output|\[\])/is.test(report);
record('runtime-evidence', ranSomething, `report shows a command and its output=${ranSomething}`);

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'refresh-mid-flow-loses-work');
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const guarded = ['src/server.js', 'src/validate.js', 'src/faults.js', 'public/app.js', 'package.json', 'PRODUCT.md', 'ux-walkthrough.md'];
const unchanged = guarded.every((file) => {
  const a = path.join(root, file);
  const b = path.join(fixture, file);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('review-only', unchanged, 'product and contract files must be byte-identical to the fixture');

// The reviewer read a state model rather than reloading a page, and the
// honest version of finding 1 says so.
const gaps = /(not (?:examine|check|verif|test|look|start|reload)|did not|unverified|out of scope|could not|from reading)/i.test(report);
const namesAbsent = /(browser|reload(?:ed)? the page|empty state|loading state|index\.html|photos|appointment)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine|everything else is fine)/i.test(low);
record('coverage-honesty', gaps && namesAbsent && noAssumption,
  `gaps named=${gaps}; specific areas named=${namesAbsent}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'refresh-mid-flow-loses-work', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
