// --cohort <harness>: what the evidence says using only the harness that is
// actually available. Promotion requires every declared cohort, so this can
// never say "ready" — it exists so a blocked cohort does not stop anyone
// reading the result that has been paid for, and so those numbers come from
// the same code path as the real ones rather than being recomputed by hand.
//
// Restricted to the most recently exercised skill version, because averaging
// a rewritten skill with the version it replaced is the bug this report was
// just fixed for.
export function applyInterimCohort(report, cohortHarness, thresholds, { mean, confidenceInterval }) {
  for (const [skill, result] of Object.entries(report.skills)) {
    const inCohort = result.experiments.filter((experiment) => experiment.harness === cohortHarness);
    const latestVersion = inCohort
      .filter((experiment) => experiment.skillVersion && experiment.latestSkillRunAt)
      .sort((a, b) => a.latestSkillRunAt.localeCompare(b.latestSkillRunAt))
      .pop()?.skillVersion || null;
    const scoped = inCohort.filter((experiment) => !experiment.skillVersion || experiment.skillVersion === latestVersion);
    const perCase = scoped.map((experiment) => {
      const skillCell = experiment.conditions.skill;
      const baseline = experiment.conditions[thresholds.primaryBaselineCondition];
      const control = experiment.conditions.control;
      if (!skillCell?.outcomeRate && skillCell?.outcomeRate !== 0) return null;
      return {
        caseId: experiment.caseId,
        trials: { skill: skillCell.trials, baseline: baseline?.trials ?? 0, control: control?.trials ?? 0 },
        skillRate: skillCell.outcomeRate,
        baselineRate: baseline?.outcomeRate ?? null,
        controlRate: control?.outcomeRate ?? null,
        outcomeDelta: baseline?.outcomeRate === null || baseline?.outcomeRate === undefined
          ? null : skillCell.outcomeRate - baseline.outcomeRate,
        discriminating: experiment.discriminating?.rates ?? null,
      };
    }).filter(Boolean);
    const usable = perCase.map((row) => row.outcomeDelta).filter((value) => value !== null);
    report.skills[skill].interim = {
      promotable: false,
      note: `Single-cohort view (${cohortHarness}). Promotion requires every declared harness; this is a partial result, not a claim.`,
      harness: cohortHarness,
      skillVersion: latestVersion,
      caseCount: perCase.length,
      outcomeDelta: usable.length ? mean(usable) : null,
      outcomeInterval: confidenceInterval(usable),
      perCase,
    };
  }
}
