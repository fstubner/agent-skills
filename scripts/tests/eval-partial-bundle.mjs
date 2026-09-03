// A bundle being written must not fail verification.
//
// eval-run.mjs used to create eval/runs/<runId>/ and fill it over the minutes
// a run takes. For all of that time the directory existed with no run.json,
// which is precisely what eval-verify refuses — so on 2026-09-03 the test
// suite went red at 2252 checks on a run that was doing nothing wrong, and
// seven downstream tests that assert "verify passes" went with it. The batch
// chains commit only on a verify pass, so a batch overlapping another batch's
// commit step would have blocked a legitimate commit.
//
// The bundle is now assembled under `.<runId>.partial` and renamed when
// run.json lands. This proves both halves: a staging directory is ignored, and
// the same directory without the dot prefix still fails.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { expect } from './harness.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const runsDir = path.join(root, 'eval', 'runs');
const verify = () => spawnSync(process.execPath, [path.join(root, 'scripts', 'eval-verify.mjs')], { cwd: root, encoding: 'utf8' });

const before = verify();
expect('eval-verify passes before the probe', before.status === 0, before.stdout || before.stderr);

// Half-written: prompt.txt has landed, run.json has not. Exactly the shape
// eval-run.mjs leaves behind for most of a run.
const staging = path.join(runsDir, '.verify-probe-partial.partial');
const plain = path.join(runsDir, 'verify-probe-partial');
for (const dir of [staging, plain]) fs.rmSync(dir, { recursive: true, force: true });
try {
  fs.mkdirSync(staging, { recursive: true });
  fs.writeFileSync(path.join(staging, 'prompt.txt'), 'a run in progress\n');
  const staged = verify();
  expect('eval-verify ignores a bundle still being assembled', staged.status === 0, staged.stdout || staged.stderr);

  // The dot prefix is what makes it invisible, not the name — without it, an
  // incomplete bundle must still be caught.
  fs.renameSync(staging, plain);
  const exposed = verify();
  expect('eval-verify still refuses an incomplete bundle that is not staged',
    exposed.status !== 0 && /missing run\.json/.test(exposed.stdout + exposed.stderr),
    exposed.stdout || exposed.stderr);
} finally {
  for (const dir of [staging, plain]) fs.rmSync(dir, { recursive: true, force: true });
}

const after = verify();
expect('eval-verify passes again once the probe is removed', after.status === 0, after.stdout || after.stderr);
