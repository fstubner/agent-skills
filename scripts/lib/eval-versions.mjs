import fs from 'node:fs';
import path from 'node:path';
import { hashStagedSkills } from './tree-hash.mjs';

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

// The digest of a case's skill text as it stands, or null when it cannot be
// computed. A skill directory absent from disk is a synthetic case in a test
// harness, not a stale one, and guessing either way would be wrong.
export function currentSkillDigest(root, skillIds) {
  if (!skillIds.every((id) => fs.existsSync(path.join(root, id)))) return null;
  return hashStagedSkills(root, skillIds);
}

// Evidence that describes a skill text nobody ships any more is not evidence
// for the one that ships. A 'legacy' arm recorded no staged digest at all, so
// nothing can be said about it — it is skipped rather than assumed stale,
// the same position the optional run-time hashes take.
export function skillCurrencyReasons(caseId, currentSkillSha256, experimentByKey, reasons) {
  let current = true;
  for (const experiment of experimentByKey.values()) {
    if (experiment.caseId !== caseId) continue;
    if (!experiment.skillVersion || experiment.skillVersion === 'legacy') continue;
    if (experiment.skillVersion === currentSkillSha256) continue;
    reasons.push(`${caseId}/${experiment.harness}/${experiment.model}: skill text has changed since these runs; the skill arm measures a superseded version`);
    current = false;
  }
  return current;
}
