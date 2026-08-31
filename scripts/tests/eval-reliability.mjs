// The reliability report must not be able to flatter a run. The traps are:
// counting not_evaluated as a pass, letting a cell with more trials look
// worse than one with fewer purely because pass^k falls with k, and reporting
// pass^k above pass@k, which is impossible by construction.
import { expect } from './harness.mjs';
import { solved, buildCells, reliability } from '../eval-reliability.mjs';

// ---------- what counts as solving ----------
expect('a fully passing rubric solves the case',
  solved({ passed: 8, failed: 0, notEvaluated: 0, total: 8 }) === true);
expect('a not_evaluated assertion is not a pass',
  solved({ passed: 7, failed: 0, notEvaluated: 1, total: 8 }) === false);
expect('a single failure is not a solve',
  solved({ passed: 7, failed: 1, notEvaluated: 0, total: 8 }) === false);
expect('an empty rubric does not solve by vacuity',
  solved({ passed: 0, failed: 0, notEvaluated: 0, total: 0 }) === false);
expect('missing grading does not solve', solved(undefined) === false);

// ---------- cell keying ----------
const run = (caseId, condition, harness, model, passed, total) => ({
  caseId, condition, harness, model, grading: { passed, failed: total - passed, notEvaluated: 0, total },
});
const cells = buildCells([
  run('c1', 'skill', 'claude-code', 'm', 4, 4),
  run('c1', 'skill', 'claude-code', 'm', 3, 4),
  run('c1', 'policy', 'claude-code', 'm', 4, 4),
  run('c1', 'skill', 'codex', 'm', 4, 4),
]);
expect('cells split on condition and on harness',
  cells.length === 3, `${cells.length} cells`);
expect('trials accumulate inside one cell',
  cells.find((c) => c.condition === 'skill' && c.harness === 'claude-code').trials.length === 2);
expect('a run without grading is skipped',
  buildCells([{ caseId: 'c', condition: 'skill' }]).length === 0);

// ---------- the metrics ----------
{
  // one cell solved on every trial, one solved on some, one never.
  const r = reliability(buildCells([
    run('a', 'skill', 'h', 'm', 4, 4), run('a', 'skill', 'h', 'm', 4, 4), run('a', 'skill', 'h', 'm', 4, 4),
    run('b', 'skill', 'h', 'm', 4, 4), run('b', 'skill', 'h', 'm', 2, 4), run('b', 'skill', 'h', 'm', 4, 4),
    run('c', 'skill', 'h', 'm', 1, 4), run('c', 'skill', 'h', 'm', 2, 4), run('c', 'skill', 'h', 'm', 0, 4),
  ]), 3);
  const s = r.byCondition.skill;
  expect('pass@k counts a cell solved at least once', s.passAtK === 2 / 3, String(s.passAtK));
  expect('pass^k counts only cells solved every time', s.passHatK === 1 / 3, String(s.passHatK));
  expect('pass@1 is the per-trial solve rate', s.pass1 === 5 / 9, String(s.pass1));
  expect('pass^k can never exceed pass@k', s.passHatK <= s.passAtK);
}

// ---------- k is held constant across cells ----------
{
  // A 3-trial cell and a 6-trial cell, both flawless on their first three.
  // Using all six trials of the second would let extra trials lower it.
  const runs = [
    run('a', 'skill', 'h', 'm', 4, 4), run('a', 'skill', 'h', 'm', 4, 4), run('a', 'skill', 'h', 'm', 4, 4),
  ];
  for (let i = 0; i < 3; i++) runs.push(run('b', 'skill', 'h', 'm', 4, 4));
  for (let i = 0; i < 3; i++) runs.push(run('b', 'skill', 'h', 'm', 1, 4));
  const r = reliability(buildCells(runs), 3);
  expect('only the first k trials of a longer cell are used',
    r.byCondition.skill.passHatK === 1, String(r.byCondition.skill.passHatK));
  expect('trial count reflects k per cell, not raw trials',
    r.byCondition.skill.trials === 6, String(r.byCondition.skill.trials));
}

// ---------- eligibility ----------
{
  const r = reliability(buildCells([
    run('a', 'skill', 'h', 'm', 4, 4), run('a', 'skill', 'h', 'm', 4, 4),
  ]), 3);
  expect('a cell below the trial floor is excluded entirely',
    r.eligibleCells === 0 && Object.keys(r.byCondition).length === 0);
}
