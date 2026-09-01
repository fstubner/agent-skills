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

const citesInRange = (file, from, to) => {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (let n = from; n <= to; n++) {
    if (n > 0 && new RegExp(`${escaped}(?:[\\s\`:,\\-–—.()]|\\blines?\\b|\\bat\\b|\\bL)*${n}\\b`, 'i').test(report)) return true;
    // Reversed order — "line 15, path/to/file". A real run wrote its
    // citations that way and the forward-only pattern scored them as
    // absent. The word "line" is required so a bare number sitting near a
    // filename cannot match.
    if (new RegExp(`\\b(?:lines?|L)\\s*${n}\\b[^\\n]{0,40}?${escaped}`, 'i').test(report)) return true;
  }
  return false;
};

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
