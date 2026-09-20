// The walkthrough replay check: the half of "I ran it" a machine can hold.
// Split out of fixtures-core.mjs on 2026-09-20, when the Playwright-shaped
// fixture and its two refusals pushed that module past the 400-line rule the
// suite's own pre-commit hook enforces.
import fs from 'fs';
import path from 'path';
import { root, read, expect, runNode, tmpBase, assertFixture, ACCEPT } from './harness.mjs';

// A-runtime-replay: the half of "I ran it" a machine can hold. replay-ship
// and replay-stale are byte-identical apart from the hash recorded in the
// run log, so the difference in verdict can only come from freshness.
assertFixture('replay-ship (walkthrough run log matches the current walkthrough)',
  'replay-ship', ACCEPT, ['--acceptor-context', 'separate', '--runtime-verified'], 'SHIP',
  [['A-runtime-replay', 'pass']]);
assertFixture('replay-stale (log came from a different walkthrough)',
  'replay-stale', ACCEPT, ['--acceptor-context', 'separate', '--runtime-verified'], 'CONDITIONAL',
  [['A-runtime-replay', 'not_evaluated']]);
// The log Playwright's JSON reporter actually writes. replay-ship's log is
// hand-stamped with a top-level specSha256, which is a shape the reporter
// never produces; for the first three weeks of this check the documented
// command could not yield a log the gate accepted, and nothing here knew,
// because every fixture was hand-written. This one carries the hash where
// the generated spec puts it — as an annotation on each test, nested one
// suite deep the way the reporter nests a file suite — and nothing at the
// top level.
assertFixture('replay-ship-playwright (hash read from Playwright test annotations)',
  'replay-ship-playwright', ACCEPT, ['--acceptor-context', 'separate', '--runtime-verified'], 'SHIP',
  [['A-runtime-replay', 'pass']]);
{
  const source = path.join(root, 'fixtures', 'replay-ship-playwright');
  const stage = (mutate) => {
    const dir = fs.mkdtempSync(path.join(tmpBase, 'replay-pw-'));
    fs.cpSync(source, dir, { recursive: true });
    const logPath = path.join(dir, '.agent-evidence', 'walkthrough-run.json');
    const log = JSON.parse(read(logPath));
    const tests = [];
    const visit = (s) => { for (const sp of s.specs || []) tests.push(...sp.tests); for (const c of s.suites || []) visit(c); };
    for (const s of log.suites) visit(s);
    mutate(tests, log);
    fs.writeFileSync(logPath, JSON.stringify(log));
    const r = runNode(path.join(root, ...ACCEPT.split('/')),
      ['--root', dir, '--acceptor-context', 'separate', '--runtime-verified', '--no-write']);
    try { return JSON.parse(r.stdout); } catch { return null; }
  };
  const replay = (report) => report?.checks.find((c) => c.id === 'A-runtime-replay');
  // A log from a spec that carried no hash — the shape the generator wrote
  // before this fix — is not evidence, and must say why.
  const unhashed = replay(stage((tests) => { for (const t of tests) t.annotations = []; }));
  expect('replay: a Playwright log with no specSha256 annotation is not_evaluated',
    unhashed?.status === 'not_evaluated' && /no specSha256/.test(unhashed.detail), JSON.stringify(unhashed));
  // Two runs stitched into one log: a stale annotation among fresh ones.
  const mixed = replay(stage((tests) => { tests[1].annotations = [{ type: 'specSha256', description: '0'.repeat(64) }]; }));
  expect('replay: one stale annotation among fresh ones is not_evaluated',
    mixed?.status === 'not_evaluated' && /different walkthrough/.test(mixed.detail), JSON.stringify(mixed));
}
// Opting in is what creates the obligation: a walkthrough with no replay
// block must not be capped for declining to automate a judgment walk.
assertFixture('accept-ship declares no replay block and still ships',
  'accept-ship', ACCEPT, ['--acceptor-context', 'separate', '--runtime-verified'], 'SHIP',
  [['A-runtime-replay', 'pass']]);

// The generator is deterministic and refuses what it cannot honestly emit.
{
  const gen = path.join(root, 'product-acceptance', 'scripts', 'gen-walkthrough-spec.mjs');
  const hashOf = (fixture) => runNode(gen, ['--root', path.join(root, 'fixtures', fixture), '--print-hash']);
  const first = hashOf('replay-ship');
  const second = hashOf('replay-ship');
  expect('walkthrough spec generation is deterministic',
    first.status === 0 && first.stdout.trim() === second.stdout.trim(), first.stdout);
  expect('a walkthrough with no replay block exits 3 rather than emitting an empty spec',
    hashOf('accept-ship').status === 3, `exit ${hashOf('accept-ship').status}`);

  const emitted = runNode(gen, ['--root', path.join(root, 'fixtures', 'replay-ship'),
    '--out', path.join(tmpBase, 'walkthrough.spec.js')]);
  const spec = read(path.join(tmpBase, 'walkthrough.spec.js'));
  expect('generated spec drives the browser from the declared steps',
    emitted.status === 0 && spec.includes('page.goto("/")') && spec.includes('page.fill("#staffId", "nurse-a")'),
    spec.slice(0, 200));
  expect('generated spec asserts the declared expectations',
    spec.includes('getByText("No notes for this shift yet")'), spec.slice(0, 300));
  expect('generated spec records its own hash so a stale run log is detectable',
    /specSha256: [0-9a-f]{64}/.test(spec));
  // A comment never reaches the run log. The hash has to ride Playwright's
  // own channel — a test annotation — or the gate can only ever read
  // hand-stamped logs, which is what it did for three weeks.
  const annotated = /testInfo\.annotations\.push\(\{ type: 'specSha256', description: "([0-9a-f]{64})" \}\)/.exec(spec);
  expect('generated spec pushes the same hash as a test annotation, where the JSON reporter will write it',
    annotated !== null && spec.includes(`// specSha256: ${annotated[1]}`), spec.slice(-400));
}
