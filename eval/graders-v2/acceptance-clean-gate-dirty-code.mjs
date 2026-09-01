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
// Accepts a citation anywhere in the handler, not just the exact line: a
// reviewer pointing at the route declaration is citing the same defect.
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
