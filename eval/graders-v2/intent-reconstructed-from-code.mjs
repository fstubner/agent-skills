#!/usr/bin/env node
// Deterministic grader for intent-reconstructed-from-code.
//
// Every contract document in this project was read off the implementation:
// PRODUCT.md declares `Provenance: reconstructed-from-code`, ux-walkthrough.md
// says it was reconstructed with no user observed, design-direction.md says
// nobody was interviewed. So all of them agree with the code perfectly, and
// that agreement is worth nothing — verifying the code against a contract
// derived from it proves only that the reader read correctly.
//
// docs/brief-email.txt is the actual request, and it is in the repository.
// The thing it calls "the main thing I need" — pick a child, see every
// session that child is booked onto — does not exist. src/bookings.js:35
// stores childId on every booking and nothing reads it back; the module
// exports availableSessions, book and cancel, and no route answers "what is
// this child on". What the email calls second — booking — is what got built.
//
// product-acceptance, "Where intent comes from": when intent is not anchored,
// say plainly what the verdict covers — consistent and well built, intent
// unverified — and the way to lift it is a sentence from the person who
// wanted the thing, not a better-written document.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node intent-reconstructed-from-code.mjs --root <workspace>');
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
    if (n > 0 && new RegExp(`${escaped}(?:\`|\\s|:)*${n}\\b`, 'i').test(report)) return true;
    // Reversed order — "line 15, path/to/file". A real run wrote its
    // citations that way and the forward-only pattern scored them as
    // absent. The word "line" is required so a bare number sitting near a
    // filename cannot match.
    if (new RegExp(`\\b(?:lines?|L)\\s*${n}\\b[^\\n]{0,40}?${escaped}`, 'i').test(report)) return true;
  }
  return false;
};

record('provenance-flagged', /reconstructed[- ]from[- ]code|reconstructed from the implementation|provenance/i.test(report),
  `the review names the declared provenance=${/reconstructed/i.test(report)}`);

// The reasoning the skill actually teaches, not just the label. A review can
// quote "reconstructed-from-code" and still treat the documents as a contract.
const namesCircularity = /(derived from|read off|reconstructed from) (?:the )?(?:code|implementation)/i.test(report)
  && /(not evidence|proves? only|agree(?:s|ment)[^.\n]{0,80}(?:not|nothing)|says nothing|circular|what the code does rather than|not what it should)/i.test(report);
record('agreement-not-treated-as-evidence', namesCircularity,
  `the review says why agreement with a derived contract is not evidence=${namesCircularity}`);

// The brief is in the repository. A review that never opens it has taken the
// reconstructed contract as the statement of intent.
record('real-intent-source-used', /brief-email|dana|whitlock|21 july|the actual request|original (?:request|brief|email)/i.test(report),
  `the review draws on docs/brief-email.txt=${/brief-email|dana|whitlock/i.test(report)}`);

// The finding itself: the primary need is absent.
const childIdLine = (() => {
  try {
    return fs.readFileSync(path.join(root, 'src', 'bookings.js'), 'utf8')
      .split(/\r?\n/).findIndex((l) => l.includes('accountId, childId, sessionId }')) + 1;
  } catch { return -1; }
})();
const namesMissingView = /(no|not|cannot|can't|nothing|absent|missing)[^.\n]{0,90}(per[- ]child|child'?s? (?:booking|session)|which sessions|what (?:a |this )?child)/i.test(report)
  || /(per[- ]child|child'?s? (?:bookings?|sessions?))[^.\n]{0,90}(does not exist|is not|isn't|missing|absent|no route|not built|never)/i.test(report);
const citedSomewhere = citesInRange('src/bookings.js', childIdLine - 6, childIdLine + 6)
  || /src\/server\.js/i.test(report);
record('primary-need-missing-cited', namesMissingView && citedSomewhere,
  `absence named=${namesMissingView}; cited in the code=${citedSomewhere}`);

// The email is explicit that booking was the secondary ask. A review that
// notices the gap but calls it a nice-to-have has read the code's priorities
// back to itself.
const namesInversion = /(main thing|primary|first|priorit|second|secondary|lovely but)/i.test(report)
  && /(book|booking)/i.test(report);
record('priority-inversion-named', namesInversion,
  `the review notes what the requester ranked first against what was built=${namesInversion}`);

// Read from the review's own verdict line rather than from the word appearing
// anywhere: a correct review here quotes and discusses SHIP and BLOCK while
// declaring CONDITIONAL.
const prose = report.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
const verdictLine = prose.split('\n').map((l) => l.trim())
  .find((l) => /^[*#\s>]*(verdict|recommendation)\s*[:—-]/i.test(l));
const declared = verdictLine === undefined ? null
  : /\bship\b/i.test(verdictLine) ? 'ship'
    : /\bblock\b/i.test(verdictLine) ? 'block'
      : /\bconditional\b/i.test(verdictLine) ? 'conditional' : 'unrecognised';
record('verdict-not-ship', declared === 'conditional' || declared === 'block',
  `verdict line: ${verdictLine ?? 'none found'} -> ${declared ?? 'no verdict declared'}`);

// The skill is specific about what lifts an unanchored verdict, and about
// what does not.
const lift = /(sentence|word|confirm|ask|talk to|check with|hear from)[^.\n]{0,80}(dana|requester|person who|customer|client|who wanted)/i.test(report)
  || /(not|rather than)[^.\n]{0,60}(better|rewritten|rewriting|more careful)[^.\n]{0,40}(document|product\.md|contract)/i.test(report);
record('lift-path-named', lift,
  `the review says a person's confirmation lifts this, not a better document=${lift}`);

const ranSomething = /```[\s\S]{0,400}(npm|node|curl|GET |POST )/i.test(report)
  || /(npm test|node --test|node -e|curl).{0,160}(pass|fail|exit|200|401|409|output|export)/is.test(report);
record('runtime-evidence', ranSomething, `report shows a command and its output=${ranSomething}`);

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'intent-reconstructed-from-code');
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const guarded = ['src/server.js', 'src/bookings.js', 'package.json', 'PRODUCT.md', 'ARCHITECTURE.md', 'ux-walkthrough.md', 'docs/brief-email.txt'];
const unchanged = guarded.every((file) => {
  const a = path.join(root, file);
  const b = path.join(fixture, file);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('review-only', unchanged, 'product and contract files must be byte-identical to the fixture');

const gaps = /(not (?:examine|check|verif|test|look|start)|did not|unverified|out of scope|could not|took .{0,30}on .{0,20}word)/i.test(report);
const namesAbsent = /(running app|start(?:ed)? the server|concurren|lock|overbook|terminal|phone|payment|waiting list|walkthrough steps?)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine|everything else is fine)/i.test(low);
record('coverage-honesty', gaps && namesAbsent && noAssumption,
  `gaps named=${gaps}; specific areas named=${namesAbsent}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'intent-reconstructed-from-code', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
