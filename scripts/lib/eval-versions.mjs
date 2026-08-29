// Which experiment speaks for a [case, harness, model] block?
//
// The report builds one experiment per staged-input version of the skill, so a
// block whose skill was rewritten between trials carries several. Promotion has
// to be judged against ONE of them — the current text — and the earlier ones
// are history, not evidence for it.
//
// This used to be `new Map(experiments.map(...))` keyed without the version, so
// a later entry overwrote an earlier one and the winner came down to directory
// order. A rewritten skill could inherit the old text's trials, or have its own
// hidden behind them.
//
// Recency comes from the runs, not the sha: "legacy" sorts above a hex digest,
// and a digest carries no ordering anyway. Experiments with no skill runs have
// no timestamp and sort first, so any real version displaces them.
export function latestExperiments(experiments) {
  const byKey = new Map();
  const supersededSkillTrials = new Map();
  for (const experiment of experiments) {
    const key = [experiment.caseId, experiment.harness, experiment.model].join('\0');
    const incumbent = byKey.get(key);
    if (!incumbent) {
      byKey.set(key, experiment);
      continue;
    }
    const candidateIsNewer = (experiment.latestSkillRunAt || '') > (incumbent.latestSkillRunAt || '');
    const [newer, older] = candidateIsNewer ? [experiment, incumbent] : [incumbent, experiment];
    byKey.set(key, newer);
    supersededSkillTrials.set(key, (supersededSkillTrials.get(key) || 0) + (older.conditions?.skill?.trials || 0));
  }
  return { byKey, supersededSkillTrials };
}

// Named so the count does not simply drop after a skill edit. Silently losing
// three trials reads as lost runs rather than as evidence that no longer
// describes the current text, and sends someone re-running work.
export function supersededReason(supersededSkillTrials, caseId, harness, model) {
  const trials = supersededSkillTrials.get([caseId, harness, model].join('\0'));
  if (!trials) return null;
  return `${caseId}/${harness}/${model}: ${trials} skill trial(s) belong to a superseded skill version and do not count toward the current one`;
}
