// Is a recorded run usable as a measurement?
//
// Extracted from eval-report.mjs on 2026-09-03, when adding the costless-
// harness exemption below pushed that file to 412 lines against the 400-line
// rule check-smells enforces on every project this suite is pointed at. The
// same rule caught scripts/eval-run.mjs an hour earlier. Splitting rather than
// trimming the explanation: this is the gate that decides what counts as
// evidence, and the reasoning behind each clause is the point.
//
// Every clause here has cost the project a wrong number at least once:
//
//   - exitCode: a run truncated by "API Error: Server error mid-response"
//     exits non-zero with tokens billed and a COMPLETE grading, scored against
//     an answer that stopped early. Two cases sat at 14 of 15 trials while the
//     batch runner called the arm finished.
//   - notEvaluated: 158 runs returned "429 session limit" in about three
//     seconds each with nothing evaluated, and three batch commits reported
//     "completed 100, failed 0".
//   - ambient skill access: a control or policy arm that reads an installed
//     skill from the user's own machine is not a control arm.

// Harnesses that report no cost at all, so a run of one must not be discarded
// for lacking it. agy's print-mode JSON carries `usage` with input, output,
// thinking, cache-read and total tokens, and no price field anywhere — its
// adapter records null cost because there is nothing to record, not because
// the parsing is weak. eval-report already handles this downstream: when cost
// is absent, resourceMetric falls back to tokens.
//
// A named set rather than dropping the check, because a claude-code or codex
// run that lost its cost would then pass silently and quietly degrade a whole
// skill's resource metric to tokens. A harness that can report cost still
// must, and one August codex run still fails here for exactly that.
export const COSTLESS_HARNESSES = new Set(['antigravity']);

// Matches a path into an installed skill directory under the user's home, in
// either Windows or POSIX form. Deliberately not anchored to this repository:
// the contamination it catches is a control arm reaching for a skill the
// machine happens to have installed, wherever that is.
const AMBIENT_SKILL_PATH = /(?:[A-Z]:\\\\Users\\\\[^\s"']+\\\\(?:\.agents|\.codex)\\\\skills\\\\|\/(?:home|Users)\/[^\s"']+\/(?:\.agents|\.codex)\/skills\/)/i;

function accessedAmbientSkill(transcript) {
  return transcript.split(/\r?\n/).filter(Boolean).some((line) => {
    try {
      const event = JSON.parse(line);
      const payload = event.payload || event;
      if (payload.type === 'custom_tool_call') return AMBIENT_SKILL_PATH.test(payload.input || '');
      if (payload.type === 'item.completed' || payload.type === 'item.started') {
        return payload.item?.type === 'command_execution' && AMBIENT_SKILL_PATH.test(payload.item.command || '');
      }
      return false;
    } catch { return false; }
  });
}

// Returns a reason string when the run must not be counted, or null when it
// may be. eval-batch.mjs mirrors the exitCode and notEvaluated clauses on the
// manifest alone — the rest needs the transcript — so that the runner's idea
// of a filled cell matches the report's idea of a usable run. When these two
// disagree the programme reports itself complete on runs the report discards.
export function runEligibility(run) {
  if (!run.testCase) return 'case definition missing';
  if (run.manifest.exitCode !== 0) return `harness exit ${run.manifest.exitCode}`;
  if (run.manifest.grading.notEvaluated !== 0) return `${run.manifest.grading.notEvaluated} assertions not evaluated`;
  if (typeof run.manifest.totalTokens !== 'number') return 'token usage missing';
  if (!COSTLESS_HARNESSES.has(run.manifest.harness)
    && typeof run.manifest.costUsd !== 'number' && typeof run.manifest.costCredits !== 'number') return 'cost usage missing';
  if (['control', 'policy'].includes(run.manifest.condition) && accessedAmbientSkill(run.transcript)) {
    return 'ambient installed skill accessed';
  }
  return null;
}
