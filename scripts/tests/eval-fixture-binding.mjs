import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { expect } from './harness.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const node = process.execPath;
const require = createRequire(import.meta.url);

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
  const runsDir = path.join(root, 'eval', 'runs');
  const caseId = 'design-system-drift';
  const bundle = fs.readdirSync(runsDir).find((name) => name.startsWith(`${caseId}-`));
  expect('a bundle exists to bind a fixture to', Boolean(bundle), String(bundle));

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

  const manifestPath = path.join(runsDir, bundle, 'run.json');
  const original = fs.readFileSync(manifestPath, 'utf8');
  const fixtureDir = path.join(root, 'eval', 'fixtures-v2', caseId);
  const correct = hashTreeForTest(fixtureDir);

  const verifyNow = () => spawnSync(node, [path.join(root, 'scripts', 'eval-verify.mjs')], { cwd: root, encoding: 'utf8' });
  try {
    const doc = JSON.parse(original);

    doc.fixtureSha256 = correct;
    fs.writeFileSync(manifestPath, `${JSON.stringify(doc, null, 2)}\n`);
    const matching = verifyNow();
    expect('eval-verify accepts a run whose fixtureSha256 matches the fixture',
      matching.status === 0, matching.stdout || matching.stderr);

    doc.fixtureSha256 = 'f'.repeat(64);
    fs.writeFileSync(manifestPath, `${JSON.stringify(doc, null, 2)}\n`);
    const mismatched = verifyNow();
    // Matches the fixture check's own wording, not merely the word "fixture":
    // a schema rejection of the unknown property also says "fixtureSha256",
    // so a loose regex passes this before the feature exists.
    expect('eval-verify rejects a run whose fixture changed after it ran',
      mismatched.status !== 0 && /fixture content changed after the run/.test(mismatched.stdout + mismatched.stderr),
      mismatched.stdout || mismatched.stderr);
  } finally {
    fs.writeFileSync(manifestPath, original);
  }
  const restored = verifyNow();
  expect('eval-verify passes again once the manifest is restored',
    restored.status === 0, restored.stdout || restored.stderr);
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
  const runsDir = path.join(root, 'eval', 'runs');
  const caseId = 'design-system-drift';
  const bundle = fs.readdirSync(runsDir).find((name) => name.startsWith(`${caseId}-`));
  const manifestPath = path.join(runsDir, bundle, 'run.json');
  const original = fs.readFileSync(manifestPath, 'utf8');
  const crypto = require('crypto');
  const graderPath = path.join(root, 'eval', 'graders-v2', `${caseId}.mjs`);
  const correct = crypto.createHash('sha256').update(fs.readFileSync(graderPath)).digest('hex');

  const verifyNow = () => spawnSync(node, [path.join(root, 'scripts', 'eval-verify.mjs')], { cwd: root, encoding: 'utf8' });
  try {
    const doc = JSON.parse(original);

    doc.graderSha256 = correct;
    fs.writeFileSync(manifestPath, `${JSON.stringify(doc, null, 2)}\n`);
    const matching = verifyNow();
    expect('eval-verify accepts a run whose graderSha256 matches the grader',
      matching.status === 0, matching.stdout || matching.stderr);

    doc.graderSha256 = 'e'.repeat(64);
    fs.writeFileSync(manifestPath, `${JSON.stringify(doc, null, 2)}\n`);
    const mismatched = verifyNow();
    expect('eval-verify rejects a run whose grader changed after it scored',
      mismatched.status !== 0 && /grader content changed after the run/.test(mismatched.stdout + mismatched.stderr),
      mismatched.stdout || mismatched.stderr);
  } finally {
    fs.writeFileSync(manifestPath, original);
  }
  const restored = verifyNow();
  expect('eval-verify passes again once the grader binding is removed',
    restored.status === 0, restored.stdout || restored.stderr);
}
