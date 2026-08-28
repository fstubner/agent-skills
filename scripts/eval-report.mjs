#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertionDiagnostics, discriminatingRate } from './lib/eval-diagnostics.mjs';
import { applyInterimCohort } from './lib/eval-interim.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
};
const evalRoot = path.resolve(valueAfter('--eval-root') || path.join(root, 'eval'));
const evidence = JSON.parse(fs.readFileSync(path.join(evalRoot, 'evidence.json'), 'utf8'));
const cases = new Map(fs.readdirSync(path.join(evalRoot, 'cases-v2'))
  .filter((name) => name.endsWith('.json'))
  .map((name) => {
    const value = JSON.parse(fs.readFileSync(path.join(evalRoot, 'cases-v2', name), 'utf8'));
    return [value.id, value];
  }));

const runs = [];
const runsDir = path.join(evalRoot, 'runs');
if (fs.existsSync(runsDir)) {
  for (const entry of fs.readdirSync(runsDir, { withFileTypes: true }).filter((item) => item.isDirectory())) {
    const runDir = path.join(runsDir, entry.name);
    const manifestPath = path.join(runDir, 'run.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const grading = JSON.parse(fs.readFileSync(path.join(runDir, manifest.files.grading), 'utf8'));
    const transcriptPath = manifest.files.transcript ? path.join(runDir, manifest.files.transcript) : null;
    const transcript = transcriptPath && fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, 'utf8') : '';
    runs.push({ manifest, grading, transcript, testCase: cases.get(manifest.caseId) });
  }
}

function runEligibility(run) {
  if (!run.testCase) return 'case definition missing';
  if (run.manifest.exitCode !== 0) return `harness exit ${run.manifest.exitCode}`;
  if (run.manifest.grading.notEvaluated !== 0) return `${run.manifest.grading.notEvaluated} assertions not evaluated`;
  if (typeof run.manifest.totalTokens !== 'number') return 'token usage missing';
  if (typeof run.manifest.costUsd !== 'number' && typeof run.manifest.costCredits !== 'number') return 'cost usage missing';
  const ambientPath = /(?:[A-Z]:\\\\Users\\\\[^\s"']+\\\\(?:\.agents|\.codex)\\\\skills\\\\|\/(?:home|Users)\/[^\s"']+\/(?:\.agents|\.codex)\/skills\/)/i;
  const accessedAmbientSkill = run.transcript.split(/\r?\n/).filter(Boolean).some((line) => {
    try {
      const event = JSON.parse(line);
      const payload = event.payload || event;
      if (payload.type === 'custom_tool_call') return ambientPath.test(payload.input || '');
      if (payload.type === 'item.completed' || payload.type === 'item.started') {
        return payload.item?.type === 'command_execution' && ambientPath.test(payload.item.command || '');
      }
      return false;
    } catch { return false; }
  });
  if (['control', 'policy'].includes(run.manifest.condition) && accessedAmbientSkill) {
    return 'ambient installed skill accessed';
  }
  return null;
}

const cells = new Map();
for (const run of runs) {
  if (runEligibility(run)) continue;
  // The staged input is part of the cell identity, not incidental metadata.
  // Editing a SKILL.md mid-experiment and re-running produced six "skill"
  // trials of one case that were three trials of two different skills; pooled
  // into one cell they average a version that no longer exists with the one
  // that does. Control and policy stage nothing, so their key is unaffected.
  const key = [
    run.testCase.skill, run.manifest.caseId, run.manifest.harness, run.manifest.model,
    run.manifest.condition, run.manifest.stagedInputSha256 || '',
  ].join('\0');
  if (!cells.has(key)) cells.set(key, []);
  cells.get(key).push(run);
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

function summarizeCell(cellRuns) {
  // The run is the experimental unit. Assertions are a rubric within a run,
  // not independent observations; flattening them would create
  // pseudoreplication and give cases with longer rubrics more weight.
  const trialOutcomeRates = cellRuns.map((run) => {
    const relevant = run.grading.assertions.filter((grade) => {
      const definition = run.testCase.assertions.find((item) => item.id === grade.id);
      return definition && ['outcome', 'quality'].includes(definition.kind);
    });
    const evaluated = relevant.filter((assertion) => assertion.status !== 'not_evaluated');
    return evaluated.length ? evaluated.filter((assertion) => assertion.status === 'pass').length / evaluated.length : null;
  });
  const costs = cellRuns.map((run) => run.manifest.costUsd).filter((value) => typeof value === 'number');
  const creditCosts = cellRuns.map((run) => run.manifest.costCredits).filter((value) => typeof value === 'number');
  const tokens = cellRuns.map((run) => run.manifest.totalTokens).filter((value) => typeof value === 'number');
  return {
    trials: cellRuns.length,
    outcomeRate: trialOutcomeRates.every((value) => value !== null) ? mean(trialOutcomeRates) : null,
    trialOutcomeRates,
    notEvaluated: trialOutcomeRates.filter((value) => value === null).length,
    meanDurationMs: mean(cellRuns.map((run) => run.manifest.durationMs)),
    meanTokens: tokens.length === cellRuns.length ? mean(tokens) : null,
    meanCostUsd: costs.length === cellRuns.length ? mean(costs) : null,
    meanCostCredits: creditCosts.length === cellRuns.length ? mean(creditCosts) : null,
  };
}

const skills = {};
for (const testCase of cases.values()) {
  skills[testCase.skill] ||= { configuredCaseIds: new Set(), experiments: [] };
  // A superseded case is excluded from the requirement. Without this, a case
  // replaced by a better one blocks promotion forever, so writing a case
  // could only ever add obligations. Retirement is declared in the case file
  // with a reason, which is what stops it becoming a way to drop a case whose
  // numbers were unwelcome.
  if (testCase.supersededBy) continue;
  skills[testCase.skill].configuredCaseIds.add(testCase.id);
}
// An experiment is one case/harness/model block at one staged-input version
// of the skill. Control and policy stage nothing, so the same baseline runs
// belong to every version's experiment — a rewritten skill is compared
// against the same baseline, not given a fresh one.
const blocks = new Map();
for (const [key, cellRuns] of cells) {
  const [skill, caseId, harness, model, condition, stagedInputSha256] = key.split('\0');
  const blockKey = [skill, caseId, harness, model].join('\0');
  if (!blocks.has(blockKey)) blocks.set(blockKey, { skill, caseId, harness, model, baselines: {}, skillVersions: new Map() });
  const block = blocks.get(blockKey);
  if (condition === 'skill') block.skillVersions.set(stagedInputSha256 || 'legacy', cellRuns);
  else block.baselines[condition] = cellRuns;
}

for (const block of blocks.values()) {
  const versions = block.skillVersions.size ? [...block.skillVersions] : [[null, null]];
  for (const [version, skillRuns] of versions) {
    const runsByCondition = { ...block.baselines };
    if (skillRuns) runsByCondition.skill = skillRuns;
    const experiment = { caseId: block.caseId, harness: block.harness, model: block.model, conditions: {} };
    if (version) experiment.skillVersion = version;
    // When the newest skill version was exercised. Sorting shas would be
    // meaningless — "legacy" sorts above a hex digest — so recency is read
    // from the runs themselves.
    if (skillRuns?.length) {
      experiment.latestSkillRunAt = skillRuns.map((run) => run.manifest.startedAt).sort().pop();
    }
    for (const [condition, cellRuns] of Object.entries(runsByCondition)) {
      experiment.conditions[condition] = summarizeCell(cellRuns);
    }
    const diagnostics = assertionDiagnostics(runsByCondition);
    const keep = new Set(diagnostics.filter((item) => item.classification === 'discriminating').map((item) => item.id));
    experiment.assertionDiagnostics = diagnostics;
    experiment.discriminating = {
      assertionCount: keep.size,
      undiscriminating: diagnostics.filter((item) => item.classification === 'undiscriminating').map((item) => item.id),
      unreachable: diagnostics.filter((item) => item.classification === 'unreachable').map((item) => item.id),
      rates: Object.fromEntries(Object.entries(runsByCondition)
        .map(([condition, cellRuns]) => [condition, discriminatingRate(cellRuns, keep)])),
    };
    skills[block.skill].experiments.push(experiment);
  }
}


// Two-sided 95% Student-t critical values. Promotion currently fixes the
// confidence level at 95% in eval/evidence.json and its schema.
const T95 = [null, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262,
  2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086,
  2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];

function confidenceInterval(values) {
  if (values.length < 2) return { confidenceLevel: evidence.minimumEvidence.confidenceLevel, n: values.length, lower: null, upper: null };
  const estimate = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - estimate) ** 2, 0) / (values.length - 1);
  const standardError = Math.sqrt(variance / values.length);
  const degreesOfFreedom = values.length - 1;
  const critical = degreesOfFreedom <= 30 ? T95[degreesOfFreedom] : 1.96;
  return {
    confidenceLevel: evidence.minimumEvidence.confidenceLevel,
    n: values.length,
    lower: estimate - critical * standardError,
    upper: estimate + critical * standardError,
  };
}

function matchedCostIncrease(experiment) {
  const baseline = experiment.conditions[evidence.minimumEvidence.primaryBaselineCondition];
  const skill = experiment.conditions.skill;
  if (typeof baseline.meanCostUsd === 'number' && baseline.meanCostUsd > 0 && typeof skill.meanCostUsd === 'number') {
    return skill.meanCostUsd / baseline.meanCostUsd - 1;
  }
  if (typeof baseline.meanCostCredits === 'number' && baseline.meanCostCredits > 0 && typeof skill.meanCostCredits === 'number') {
    return skill.meanCostCredits / baseline.meanCostCredits - 1;
  }
  return null;
}

const ineligibleRuns = runs.map((run) => ({ run, reason: runEligibility(run) })).filter((item) => item.reason);
const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  totalRuns: runs.length,
  eligibleRuns: runs.length - ineligibleRuns.length,
  ineligibleRuns: ineligibleRuns.map(({ run, reason }) => ({ runId: run.manifest.runId, reason, exitCode: run.manifest.exitCode, notEvaluated: run.manifest.grading.notEvaluated })),
  thresholds: evidence.minimumEvidence,
  skills: {},
};

// Every harness/model cohort the contract requires, flat. Nesting these
// loops at the call site reached depth 7 and this repository's own
// code-smells gate blocked the commit that touched the file.
function emptyExperiment(caseId, harness, model) {
  return { caseId, harness, model, conditions: {} };
}

function requiredCohorts(thresholds) {
  return thresholds.requiredHarnesses.flatMap((harness) =>
    thresholds.requiredModelsByHarness[harness].map((model) => ({ harness, model })));
}

function cohortTrialGaps(experiment, thresholds, label) {
  return thresholds.requiredConditions.flatMap((condition) => {
    const cell = experiment?.conditions[condition];
    if (cell && cell.trials >= thresholds.trialsPerCondition) return [];
    return [`${label}/${condition} needs ${thresholds.trialsPerCondition} trials; has ${cell?.trials || 0}`];
  });
}

for (const [skill, value] of Object.entries(skills)) {
  const thresholds = evidence.minimumEvidence;
  const reasons = [];
  const experimentByKey = new Map(value.experiments.map((experiment) => [
    [experiment.caseId, experiment.harness, experiment.model].join('\0'), experiment,
  ]));
  const expectedExperiments = [];
  const completedCaseIds = [];

  for (const caseId of value.configuredCaseIds) {
    const testCase = cases.get(caseId);
    let caseComplete = true;
    for (const condition of thresholds.requiredConditions) {
      if (!testCase.conditions.includes(condition)) {
        reasons.push(`${caseId} is not configured for required condition ${condition}`);
        caseComplete = false;
      }
    }
    for (const { harness, model } of requiredCohorts(thresholds)) {
      const experiment = experimentByKey.get([caseId, harness, model].join('\0'));
      // Built by a helper rather than inline: the nesting checker counts
      // object-literal braces, so `conditions: {}` three loops deep reads as
      // depth 6 even though the control flow is three levels.
      expectedExperiments.push(experiment || emptyExperiment(caseId, harness, model));
      const gaps = cohortTrialGaps(experiment, thresholds, `${caseId}/${harness}/${model}`);
      if (gaps.length) {
        reasons.push(...gaps);
        caseComplete = false;
      }
    }
    if (caseComplete) completedCaseIds.push(caseId);
  }

  if (value.configuredCaseIds.size < thresholds.freshCasesPerSkill) {
    reasons.push(`needs ${thresholds.freshCasesPerSkill} configured fresh cases; has ${value.configuredCaseIds.size}`);
  }
  if (completedCaseIds.length < thresholds.freshCasesPerSkill) {
    reasons.push(`needs ${thresholds.freshCasesPerSkill} completed fresh cases; has ${completedCaseIds.length}`);
  }

  const comparable = expectedExperiments.filter((experiment) => thresholds.requiredConditions.every((condition) => {
    const cell = experiment.conditions[condition];
    return cell?.trials >= thresholds.trialsPerCondition && cell.outcomeRate !== null;
  }));
  const baselineCondition = thresholds.primaryBaselineCondition;
  const observedComparisons = value.experiments
    .filter((experiment) => thresholds.requiredConditions.every((condition) => experiment.conditions[condition]?.trials > 0))
    .map((experiment) => {
      const skillCell = experiment.conditions.skill;
      const baselineCell = experiment.conditions[baselineCondition];
      const controlCell = experiment.conditions.control;
      return {
        caseId: experiment.caseId,
        harness: experiment.harness,
        model: experiment.model,
        baselineCondition,
        outcomeDelta: skillCell.outcomeRate - baselineCell.outcomeRate,
        controlOutcomeDelta: skillCell.outcomeRate - controlCell.outcomeRate,
        costIncrease: matchedCostIncrease(experiment),
        tokenIncrease: skillCell.meanTokens !== null && baselineCell.meanTokens > 0 ? skillCell.meanTokens / baselineCell.meanTokens - 1 : null,
      };
    });

  // Cases are the independent task samples. Harness/model cohorts are blocks
  // within a case, so averaging them first prevents a wider model matrix from
  // manufacturing a larger statistical sample.
  const expectedCohortsPerCase = thresholds.requiredHarnesses.reduce(
    (sum, harness) => sum + thresholds.requiredModelsByHarness[harness].length, 0,
  );
  const caseComparisons = [...value.configuredCaseIds].map((caseId) => {
    const experiments = comparable.filter((experiment) => experiment.caseId === caseId);
    if (experiments.length !== expectedCohortsPerCase) return null;
    const caseCostDeltas = experiments.map(matchedCostIncrease);
    const caseTokenDeltas = experiments.map((experiment) => {
      const skillCell = experiment.conditions.skill;
      const baselineCell = experiment.conditions[baselineCondition];
      return skillCell.meanTokens !== null && baselineCell.meanTokens > 0 ? skillCell.meanTokens / baselineCell.meanTokens - 1 : null;
    });
    return {
      caseId,
      outcomeDelta: mean(experiments.map((experiment) => experiment.conditions.skill.outcomeRate - experiment.conditions[baselineCondition].outcomeRate)),
      costIncrease: caseCostDeltas.every((value) => value !== null) ? mean(caseCostDeltas) : null,
      tokenIncrease: caseTokenDeltas.every((value) => value !== null) ? mean(caseTokenDeltas) : null,
    };
  }).filter(Boolean);
  const deltas = caseComparisons.map((comparison) => comparison.outcomeDelta);
  const outcomeDelta = deltas.length ? mean(deltas) : null;
  const outcomeInterval = confidenceInterval(deltas);
  const costDeltas = caseComparisons.map((comparison) => comparison.costIncrease);
  const costIncrease = costDeltas.length && costDeltas.every((value) => value !== null) ? mean(costDeltas) : null;
  const costInterval = costIncrease === null ? confidenceInterval([]) : confidenceInterval(costDeltas);
  const tokenDeltas = caseComparisons.map((comparison) => comparison.tokenIncrease);
  const tokenIncrease = tokenDeltas.length && tokenDeltas.every((value) => value !== null) ? mean(tokenDeltas) : null;
  const tokenInterval = tokenIncrease === null ? confidenceInterval([]) : confidenceInterval(tokenDeltas);
  const resourceMetric = costIncrease !== null ? 'cost' : tokenIncrease !== null ? 'tokens' : null;
  const resourceIncrease = resourceMetric === 'cost' ? costIncrease : tokenIncrease;
  const resourceInterval = resourceMetric === 'cost' ? costInterval : tokenInterval;

  let decision = 'insufficient-evidence';
  const matrixComplete = completedCaseIds.length >= thresholds.freshCasesPerSkill
    && completedCaseIds.length === value.configuredCaseIds.size;
  if (matrixComplete) {
    const qualityWin = outcomeInterval.lower !== null
      && outcomeInterval.lower >= thresholds.outcomeDeltaRequired;
    const efficiencyWin = resourceIncrease !== null
      && resourceInterval.upper !== null
      && resourceInterval.upper <= -thresholds.efficiencyReductionRequired
      && outcomeInterval.lower !== null
      && outcomeInterval.lower >= -thresholds.outcomeNonInferiorityMargin;
    decision = qualityWin && efficiencyWin ? 'quality-and-efficiency-winner'
      : qualityWin ? 'quality-winner'
        : efficiencyWin ? 'efficiency-winner'
          : 'no-demonstrated-win';
    if (decision === 'no-demonstrated-win') reasons.push('confidence intervals do not establish a quality or efficiency win');
  }
  const promoted = ['quality-and-efficiency-winner', 'quality-winner', 'efficiency-winner'].includes(decision);
  report.skills[skill] = {
    ready: promoted && reasons.length === 0,
    decision,
    configuredCaseCount: value.configuredCaseIds.size,
    completedCaseCount: completedCaseIds.length,
    caseCount: completedCaseIds.length,
    completedCaseIds,
    outcomeDelta,
    outcomeInterval,
    costIncrease,
    costInterval,
    tokenIncrease,
    tokenInterval,
    resourceMetric,
    statisticalUnit: 'case',
    caseComparisons,
    observedComparisons,
    reasons: [...new Set(reasons)],
    experiments: value.experiments,
  };
}

// Single-harness view when a cohort is blocked; never promotable. See
// scripts/lib/eval-interim.mjs.
const cohortHarness = valueAfter('--cohort');
if (cohortHarness) applyInterimCohort(report, cohortHarness, evidence.minimumEvidence, { mean, confidenceInterval });

const output = args.includes('--compact')
  ? {
      generatedAt: report.generatedAt,
      totalRuns: report.totalRuns,
      eligibleRuns: report.eligibleRuns,
      skills: Object.fromEntries(Object.entries(report.skills).map(([name, result]) => [name, {
        ready: result.ready,
        decision: result.decision,
        configuredCaseCount: result.configuredCaseCount,
        completedCaseCount: result.completedCaseCount,
        observedComparisons: result.observedComparisons,
        reasons: result.reasons,
      }])),
    }
  : report;
console.log(JSON.stringify(output, null, 2));
if (args.includes('--require-ready') && Object.values(report.skills).some((skill) => !skill.ready)) process.exit(1);
