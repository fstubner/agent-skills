// Diagnostics that sit beside the promotion decision without entering it.
// Split out of eval-report.mjs when that file crossed the 400-line bar this
// suite enforces on everyone else.

// Per-assertion diagnostics, reported but deliberately NOT fed into the
// promotion decision. Two shapes are worth naming:
//
//   undiscriminating — passes in every control trial AND every skill trial.
//     The model does this unaided; carrying it inflates both arms and
//     compresses the measured delta.
//   unreachable — fails in every trial of every condition. Either the
//     assertion is broken or the task cannot express it.
//
// The promotion metric keeps using the full rubric, because quietly
// dropping assertions after seeing results is how a bar gets moved to fit
// the data. This surfaces the inflation instead of acting on it.
export function assertionDiagnostics(runsByCondition) {
  const ids = new Set();
  for (const runs of Object.values(runsByCondition)) {
    for (const run of runs) for (const grade of run.grading.assertions) ids.add(grade.id);
  }
  return [...ids].map((id) => {
    const counts = {};
    for (const [condition, runs] of Object.entries(runsByCondition)) {
      const graded = runs
        .map((run) => run.grading.assertions.find((grade) => grade.id === id))
        .filter((grade) => grade && grade.status !== 'not_evaluated');
      counts[condition] = { pass: graded.filter((grade) => grade.status === 'pass').length, graded: graded.length };
    }
    const control = counts.control;
    const skill = counts.skill;
    const everyConditionZero = Object.values(counts).every((c) => c.graded > 0 && c.pass === 0);
    let classification = 'discriminating';
    if (control?.graded && skill?.graded && control.pass === control.graded && skill.pass === skill.graded) {
      classification = 'undiscriminating';
    } else if (everyConditionZero) {
      classification = 'unreachable';
    }
    return { id, classification, counts };
  });
}

// Outcome rate over the discriminating assertions only — what the delta
// looks like once the ones the model passes unaided are set aside.
export function discriminatingRate(runs, keepIds) {
  const rates = runs.map((run) => {
    const graded = run.grading.assertions
      .filter((grade) => keepIds.has(grade.id) && grade.status !== 'not_evaluated');
    return graded.length ? graded.filter((grade) => grade.status === 'pass').length / graded.length : null;
  }).filter((value) => value !== null);
  return rates.length ? rates.reduce((sum, value) => sum + value, 0) / rates.length : null;
}
