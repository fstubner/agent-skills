// eval-power.mjs derives freshCasesPerSkill from the observed case-level
// spread. The promotion contract cites its answer, and until now nothing
// checked the arithmetic — a wrong t-quantile or a one-sided table (which the
// first draft had) would have moved the contract's own bar without any test
// noticing.
//
// --sigma bypasses the observed estimate, so the required count is a pure
// function of the constants in the file and can be pinned by hand:
//
//   need(n) = (t95[n-1] + t80[n-1]) * sigma / sqrt(n)  <=  design - threshold
//
// With threshold 0.1, design 2x, sigma 0.134 (the between-case SD recorded
// in eval/evidence.json's programme notes): n=14 gives (2.160+0.692)*0.134/
// sqrt(14) = 0.1021, over; n=15 gives (2.145+0.692)*0.134/sqrt(15) = 0.0982,
// under. So 15 — which is the number the contract carries.
import path from 'path';
import { spawnSync } from 'child_process';
import { expect } from './harness.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const run = (sigma) => spawnSync(process.execPath, [path.join(root, 'scripts', 'eval-power.mjs'), '--sigma', String(sigma)],
  { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const casesFor = (out) => Number(/pooled estimate\s+sigma=[\d.]+\s+->\s+(\d+) cases/.exec(out)?.[1]);

const at134 = run(0.134);
expect('eval-power runs with an explicit sigma', at134.status === 0, at134.stderr || at134.stdout);
expect('eval-power: sigma 0.134 requires 15 cases (hand-checked against the t tables)',
  casesFor(at134.stdout) === 15, at134.stdout);

// More spread means more cases. A sign error or a swapped table breaks this
// before it breaks anything subtler.
const at200 = run(0.2);
expect('eval-power: a larger sigma requires more cases',
  casesFor(at200.stdout) > casesFor(at134.stdout), `${casesFor(at134.stdout)} at 0.134, ${casesFor(at200.stdout)} at 0.2`);
