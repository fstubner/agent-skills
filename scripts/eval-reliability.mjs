#!/usr/bin/env node
// Reliability report over run bundles already on disk. Adds nothing to the
// evidence contract and promotes nothing; it re-reads recorded gradings and
// asks a question the promotion statistics do not.
//
// eval-report.mjs averages trials within a cell and treats the case as the
// statistical unit, which answers "how much does the skill lift the average".
// That is the right primary question and it hides consistency: a cell that
// scores 1.0, 0.4, 1.0 and a cell that scores 0.8 three times have the same
// mean and are not the same thing to anyone relying on the behaviour.
//
// So, following tau-bench (arXiv 2406.12045), three numbers per condition,
// where a trial "solves" a case only if every assertion in it passed:
//   pass@1  the mean solve rate over single trials
//   pass@k  at least one of a cell's k trials solved it   (optimistic)
//   pass^k  every one of a cell's k trials solved it      (the reliable one)
//
// pass@k over pass^k is the inconsistency. tau-bench's headline was a model
// at 61% pass@1 falling to 25% pass^8; the same gap here would mean a skill
// whose recorded lift is real on average and not dependable per attempt.
//
// A cell is one (case, condition, harness, model). Cells are compared only
// against cells with the same k, because pass^k falls with k by construction
// and mixing 3-trial and 9-trial cells would read as an effect.
//
// usage: node scripts/eval-reliability.mjs [--min-trials 3] [--json]
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const root = path.resolve(import.meta.dirname, '..');

export function collectRuns(runsDir) {
  const out = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'run.json') {
        try { out.push(JSON.parse(fs.readFileSync(p, 'utf8'))); } catch { /* skip unreadable */ }
      }
    }
  };
  walk(runsDir);
  return out;
}

// A trial solves its case only when nothing in the rubric failed and nothing
// was left unevaluated. not_evaluated is not a pass anywhere else in this
// suite and is not one here.
export function solved(grading) {
  if (!grading || !grading.total) return false;
  return grading.passed === grading.total;
}

export function buildCells(runs) {
  const cells = new Map();
  for (const r of runs) {
    if (!r.grading || !r.caseId || !r.condition) continue;
    const key = [r.caseId, r.condition, r.harness, r.model].join('|');
    if (!cells.has(key)) {
      cells.set(key, { caseId: r.caseId, condition: r.condition, harness: r.harness, model: r.model, trials: [] });
    }
    cells.get(key).trials.push({
      solved: solved(r.grading),
      rate: r.grading.passed / r.grading.total,
    });
  }
  return [...cells.values()];
}

export function reliability(cells, minTrials) {
  const eligible = cells.filter((c) => c.trials.length >= minTrials);
  const byCondition = {};
  for (const cell of eligible) {
    const k = Math.min(cell.trials.length, minTrials);
    const window = cell.trials.slice(0, k);
    const b = byCondition[cell.condition] ?? (byCondition[cell.condition] = {
      cells: 0, trials: 0, solvedTrials: 0, anySolved: 0, allSolved: 0, assertionRate: 0,
    });
    b.cells++;
    b.trials += window.length;
    b.solvedTrials += window.filter((t) => t.solved).length;
    if (window.some((t) => t.solved)) b.anySolved++;
    if (window.every((t) => t.solved)) b.allSolved++;
    b.assertionRate += window.reduce((s, t) => s + t.rate, 0) / window.length;
  }
  for (const b of Object.values(byCondition)) {
    b.pass1 = b.trials ? b.solvedTrials / b.trials : null;
    b.passAtK = b.cells ? b.anySolved / b.cells : null;
    b.passHatK = b.cells ? b.allSolved / b.cells : null;
    b.meanAssertionRate = b.cells ? b.assertionRate / b.cells : null;
  }
  return { k: minTrials, eligibleCells: eligible.length, byCondition };
}

function pct(x) { return x === null ? '  n/a' : `${(x * 100).toFixed(0).padStart(3)}%`; }

function main() {
  const argv = process.argv.slice(2);
  const minTrials = Number(argv.includes('--min-trials') ? argv[argv.indexOf('--min-trials') + 1] : 3);
  const runs = collectRuns(path.join(root, 'eval', 'runs'));
  const cells = buildCells(runs);
  const report = reliability(cells, minTrials);

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ schemaVersion: 1, ...report, bundles: runs.length }, null, 1));
    return;
  }

  console.log(`run bundles read: ${runs.length}`);
  console.log(`cells (case x condition x harness x model): ${cells.length}`);
  console.log(`cells with >= ${minTrials} trials: ${report.eligibleCells}  (first ${minTrials} trials of each used)\n`);
  console.log(`condition    cells   pass@1  pass@${minTrials}  pass^${minTrials}   mean assertion rate`);
  for (const [condition, b] of Object.entries(report.byCondition).sort()) {
    console.log(`  ${condition.padEnd(10)}${String(b.cells).padStart(4)}    ${pct(b.pass1)}   ${pct(b.passAtK)}   ${pct(b.passHatK)}        ${pct(b.meanAssertionRate)}`);
  }
  console.log('\npass@1 = mean solve rate per trial; pass@k = any trial solved; pass^k = every trial solved.');
  console.log('A trial solves a case only when every assertion passed and none was not_evaluated.');
  console.log('The gap between pass@k and pass^k is inconsistency, invisible in the promotion statistics.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
