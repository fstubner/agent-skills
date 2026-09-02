import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { expect } from './harness.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const node = process.execPath;
const require = createRequire(import.meta.url);
const runsDir = path.join(root, 'eval', 'runs');
const verifyNow = () => spawnSync(node, [path.join(root, 'scripts', 'eval-verify.mjs')], { cwd: root, encoding: 'utf8' });

// Each check below proves a binding works by showing eval-verify a run whose
// hash is wrong. They used to do that by editing a REAL bundle's run.json in
// place and putting it back in a finally block.
//
// On 2026-09-02 that bill came due. A transient filesystem error (UNKNOWN,
// errno -4094) landed on the restoring write itself, the suite died, and a
// committed run manifest was left modified in the working tree. It was
// recovered with git checkout, but a test that corrupts real evidence to prove
// the corruption check works can corrupt it for good — and the window is every
// run of the suite, on the one file whose whole purpose is being trustworthy.
//
// So the sabotage now happens to a DISPOSABLE COPY of the bundle, placed beside
// the originals so eval-verify picks it up, and deleted afterwards. The
// original is never opened for writing. A crash here leaves an untracked
// directory that `git status` shows and `rm -r` fixes, instead of a damaged
// record that looks exactly like a real one.
//
// The copy is removed before the run starts as well as after it ends, so a
// bundle stranded by an earlier crash cannot fail the next suite.
function withDisposableBundle(caseId, label, body) {
  const source = fs.readdirSync(runsDir).find((name) => name.startsWith(`${caseId}-`));
  expect(`a bundle exists ${label}`, Boolean(source), String(source));
  if (!source) return;

  const runId = `${source}-binding-probe`;
  const dir = path.join(runsDir, runId);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(path.join(runsDir, source), dir, { recursive: true });
  const manifestPath = path.join(dir, 'run.json');
  // runId must equal the directory name, so the copy carries its own.
  const doc = { ...JSON.parse(fs.readFileSync(manifestPath, 'utf8')), runId };
  const write = (patch) => fs.writeFileSync(manifestPath, `${JSON.stringify({ ...doc, ...patch }, null, 2)}\n`);
  try {
    write({});
    body(write);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const removed = verifyNow();
  expect(`eval-verify passes again once the ${caseId} probe is removed`,
    removed.status === 0, removed.stdout || removed.stderr);
}

// ---------- A run must record the fixture it ran against ----------
//
// run.json bound the case text (caseSha256) and the staged skill
// (stagedInputSha256) but not the FIXTURE. Editing a fixture therefore
// invalidated nothing: the old results kept standing as evidence for a task
// that no longer existed. Found on 2026-08-29 while hardening
// design-system-drift — only the case-revision bump saved those runs from
// silently surviving, and that bump was incidental.
//
// The field is optional in the schema so the 328 bundles predating it stay
// valid. They are simply unbound: nothing can now be said about which fixture
// they ran against, which is the honest position rather than backfilling a
// hash that asserts something nobody measured.
{
  const caseId = 'design-system-drift';
  // Deliberately a third implementation rather than an import: if this agreed
  // with eval-run and eval-verify by sharing their code, it could not catch
  // the two of them agreeing on a wrong hash. The digest is the contract.
  const crypto = require('crypto');
  const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
  const hashTreeForTest = (treeRoot) => {
    const chunks = [];
    (function visit(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(treeRoot, full).split(path.sep).join('/');
        if (entry.isDirectory()) visit(full);
        else if (entry.isFile()) chunks.push(`${rel}\0${sha256(fs.readFileSync(full))}\n`);
      }
    })(treeRoot);
    return sha256(chunks.join(''));
  };

  const correct = hashTreeForTest(path.join(root, 'eval', 'fixtures-v2', caseId));

  withDisposableBundle(caseId, 'to bind a fixture to', (write) => {
    write({ fixtureSha256: correct });
    const matching = verifyNow();
    expect('eval-verify accepts a run whose fixtureSha256 matches the fixture',
      matching.status === 0, matching.stdout || matching.stderr);

    write({ fixtureSha256: 'f'.repeat(64) });
    const mismatched = verifyNow();
    // Matches the fixture check's own wording, not merely the word "fixture":
    // a schema rejection of the unknown property also says "fixtureSha256",
    // so a loose regex passes this before the feature exists.
    expect('eval-verify rejects a run whose fixture changed after it ran',
      mismatched.status !== 0 && /fixture content changed after the run/.test(mismatched.stdout + mismatched.stderr),
      mismatched.stdout || mismatched.stderr);
  });
}

// ---------- A run must record the grader that scored it ----------
//
// The fixture and the case text are now bound; the GRADER was not. Editing a
// grader silently reinterprets every result it ever produced, and the failure
// is quieter than the fixture one because nothing about the workspace looks
// different — only the verdict does.
//
// Found on 2026-08-29 mid-pilot: design-system-drift's tokenValues() flattened
// one level of nesting, so a token file nested three deep read as having no
// colours. The grader reached the right verdict from false evidence ("0 of the
// 7 source greys survive" when all 7 did). Fixing it changed what the stored
// runs meant, and only knowing I had just edited it stopped stale grading from
// standing.
//
// Every grader imports Node built-ins only, and the four that import
// dynamically pull from the workspace under test rather than from suite code,
// so the grader's own bytes fully determine its behaviour. One file, one hash.
{
  const caseId = 'design-system-drift';
  const crypto = require('crypto');
  const graderPath = path.join(root, 'eval', 'graders-v2', `${caseId}.mjs`);
  const correct = crypto.createHash('sha256').update(fs.readFileSync(graderPath)).digest('hex');

  withDisposableBundle(caseId, 'to bind a grader to', (write) => {
    write({ graderSha256: correct });
    const matching = verifyNow();
    expect('eval-verify accepts a run whose graderSha256 matches the grader',
      matching.status === 0, matching.stdout || matching.stderr);

    write({ graderSha256: 'e'.repeat(64) });
    const mismatched = verifyNow();
    expect('eval-verify rejects a run whose grader changed after it scored',
      mismatched.status !== 0 && /grader content changed after the run/.test(mismatched.stdout + mismatched.stderr),
      mismatched.stdout || mismatched.stderr);
  });
}

// ---------- A run records the checker its grader may execute ----------
//
// Three graders SPAWN a suite checker while scoring —
// account-suspension-boundary runs check-organization, invoice-suspension-
// refactor runs check-smells, postgres-required-handle runs check-migrations —
// and in each the case declares that same script as its `checker`. So a change
// to a checker moves those verdicts while both the grader file and the fixture
// stay byte-identical, and graderSha256 cannot see it.
//
// All three are single files requiring Node built-ins only, so one hash is the
// whole dependency. Worth stating because it is the assumption that makes a
// file hash sufficient rather than a tree hash.
//
// Note the checker CONDITION has zero runs to date. The binding earns its
// place through the graders that execute a checker, not through that arm.
{
  const caseId = 'postgres-required-handle';
  const checkerRel = 'data-modeling/scripts/check-migrations.js';
  const crypto = require('crypto');
  const correct = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, ...checkerRel.split('/')))).digest('hex');

  withDisposableBundle(caseId, 'for a case that declares a checker', (write) => {
    write({ checkerSha256: correct });
    const matching = verifyNow();
    expect('eval-verify accepts a run whose checkerSha256 matches the checker',
      matching.status === 0, matching.stdout || matching.stderr);

    write({ checkerSha256: 'd'.repeat(64) });
    const mismatched = verifyNow();
    expect('eval-verify rejects a run whose checker changed after it ran',
      mismatched.status !== 0 && /checker content changed after the run/.test(mismatched.stdout + mismatched.stderr),
      mismatched.stdout || mismatched.stderr);
  });
}
