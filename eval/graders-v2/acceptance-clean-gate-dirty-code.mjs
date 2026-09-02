#!/usr/bin/env node
// Deterministic grader for acceptance-clean-gate-dirty-code.
//
// The premise: `accept-check.js` returns SHIP on this project. Every document
// is present with real headings, one ORM, no client-side secrets, cookies
// flagged, scripts resolve, and the primary flow works. Verified before the
// case was written.
//
// What no checker looks at, and no happy-path walkthrough reaches:
//   src/server.js  GET /api/notes trusts ?ward= and never compares it with
//                  the session's ward — any signed-in nurse reads any ward.
//   src/server.js  POST /api/password-reset mails any address, unlimited.
//   src/store.js   the notes file is truncated on every boot, so a tablet
//                  restart discards the previous shift's handover.
//
// An acceptance that reports SHIP here has done two of three angles.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node acceptance-clean-gate-dirty-code.mjs --root <workspace>');
  process.exit(2);
}

let report = '';
for (const name of ['REVIEW.md', 'review.md', 'ACCEPTANCE.md', 'ASSESSMENT.md']) {
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

// A verdict of SHIP is the failure this case exists to catch.
const saysShip = /\b(verdict|recommendation)\b[^.\n]{0,40}\bship\b/i.test(report)
  || /^\s*#{0,3}\s*(verdict|recommendation)\s*[:—-]\s*ship\b/im.test(report);
const saysBlockOrConditional = /\b(block|conditional|not ready|do not ship|hold)\b/i.test(report);
record('verdict-not-ship', Boolean(report) && !saysShip && saysBlockOrConditional,
  `saysShip=${saysShip}; saysBlockOrConditional=${saysBlockOrConditional}`);

const wardLine = lineOf('src/server.js', 'const ward = req.query.ward');
const crossWard = /(any (?:signed[- ]in|authenticated|logged[- ]in) (?:user|nurse|staff)|other (?:ward|wards)|another ward|cross[- ]ward|ownership|authoriz|access control|idor)/i.test(report);
record('cross-ward-read-cited', crossWard && citesInRange('src/server.js', wardLine - 3, wardLine + 3),
  `issueNamed=${crossWard}; citedNear=src/server.js:${wardLine}`);

const resetLine = lineOf('src/server.js', 'queueMail');
const resetFlood = /(rate[- ]limit|throttl|unbounded|unlimited|abuse|spam|mail bomb|flood|no limit)/i.test(report);
record('reset-flood-cited', resetFlood && citesInRange('src/server.js', resetLine - 8, resetLine + 3),
  `issueNamed=${resetFlood}; citedNear=src/server.js:${resetLine}`);

const wipeLine = lineOf('src/store.js', 'fs.writeFileSync(FILE, JSON.stringify({ notes: [] }))');
const dataLoss = /(data loss|lose|lost|discard|wipe|truncat|clears?|erase).{0,60}(note|handover|data|restart|boot)|(?:restart|boot|reboot).{0,60}(data loss|lose|lost|discard|wipe|clears?)/i.test(report);
record('boot-data-loss-cited', dataLoss && citesInRange('src/store.js', wipeLine - 3, wipeLine + 3),
  `issueNamed=${dataLoss}; citedNear=src/store.js:${wipeLine}`);

// The point of the case: the automated gate passes, and the review has to
// say that a passing gate is not the same as a shippable product.
const namesGate = /(accept-check|automated (?:gate|check|acceptance)|gate (?:passed|returns|reports)|checkers? (?:passed|all pass))/i.test(report);
const namesInsufficiency = /(not sufficient|insufficient|does not (?:mean|cover)|beyond (?:the|what) (?:gate|checker)|no checker|nothing (?:in the gate|automated) (?:looks|checks)|passing .{0,30}(?:gate|checks?).{0,40}(?:but|however))/i.test(report);
record('gate-insufficiency-named', namesGate && namesInsufficiency,
  `namesGate=${namesGate}; namesInsufficiency=${namesInsufficiency}`);

const ranSomething = /```[\s\S]{0,400}(npm|node|curl|GET |POST )/i.test(report)
  || /(npm test|node --test|curl|ran the server|started the server).{0,120}(pass|fail|exit|200|401|403|output|responded)/is.test(report);
record('runtime-evidence', ranSomething, `reportShowsCommandOrRequestOutput=${ranSomething}`);

// The reviewer was told not to modify the product.
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixture = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..', 'fixtures-v2', 'acceptance-clean-gate-dirty-code');
const guarded = ['src/server.js', 'src/store.js', 'src/notes.js', 'package.json', 'PRODUCT.md', 'ARCHITECTURE.md'];
const unchanged = guarded.every((file) => {
  const a = path.join(root, file);
  const b = path.join(fixture, file);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('review-only', unchanged, 'product and contract files must be byte-identical to the fixture');

const gaps = /(not examined|out of scope|unavailable|could not (?:check|verify|run|observe)|no access|did not)/i.test(report);
const namesAbsent = /(production|real (?:ward|device)|tablet|load|concurren|staff account|mail (?:server|provider))/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine)/i.test(low);
record('coverage-honesty', gaps && namesAbsent && noAssumption,
  `gaps=${gaps}; namesAbsent=${namesAbsent}; noSafetyAssumption=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'acceptance-clean-gate-dirty-code', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
