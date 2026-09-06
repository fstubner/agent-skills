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
//   - a suite checker report in a control workspace: the antigravity control
//     arm ran product-acceptance's own gate from the installed plugin in 18 of
//     18 runs, so "skill minus control" measured only what the prose adds on
//     top of a gate the control already had, and read as -9pp. The path check
//     below could not have caught it: agy's print-mode transcript is a single
//     JSON turn with no tool log. The report file is the harness-independent
//     tell — only the suite's scripts write one, and those arms have none.
import fs from 'fs';
import path from 'path';

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
// machine happens to have installed, wherever that is. `.gemini` covers both
// of Antigravity's install roots — antigravity-cli/skills and config/plugins.
const AMBIENT_SKILL_PATH = /(?:[A-Z]:\\\\Users\\\\[^\s"']+\\\\(?:\.agents|\.codex|\.gemini)\\\\|\/(?:home|Users)\/[^\s"']+\/(?:\.agents|\.codex|\.gemini)\/)/i;

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

const reportsUnder = (dir) => {
  const evidence = path.join(dir, '.agent-evidence');
  if (!evidence || !fs.existsSync(evidence)) return new Map();
  return new Map(fs.readdirSync(evidence).filter((name) => name.endsWith('-report.json'))
    .map((name) => [name, fs.readFileSync(path.join(evidence, name))]));
};

// Suite checker reports the RUN produced, as opposed to ones its fixture
// planted. A control or policy arm is staged with no suite scripts at all, so
// a report it did not start with can only have come from a copy installed on
// the machine. Reading the workspace rather than the transcript, because the
// transcript is whatever the harness chose to log and agy logs nothing.
//
// Seven fixtures plant a stale report deliberately — checker-crash-read-as-pass
// ships a backend-report.json from 9 August for the case to be about — and
// the first version of this counted those, which zeroed every control and
// policy arm of the cases built around them. A report byte-identical to the
// fixture's is the fixture; one the fixture lacks, or one whose bytes moved,
// is something the arm ran.
export function suiteReportsProducedIn(runDir, fixtureDir) {
  if (!runDir) return [];
  const produced = reportsUnder(path.join(runDir, 'outputs'));
  const planted = fixtureDir ? reportsUnder(fixtureDir) : new Map();
  return [...produced.entries()]
    .filter(([name, bytes]) => !planted.has(name) || !planted.get(name).equals(bytes))
    .map(([name]) => name)
    .sort();
}

// Returns a reason string when the run must not be counted, or null when it
// may be. eval-batch.mjs mirrors the manifest-only clauses and the workspace
// clause — the ambient-path one needs the transcript — so that the runner's
// idea of a filled cell matches the report's idea of a usable run. When these
// two disagree the programme reports itself complete on runs the report
// discards; that has happened four times.
export function runEligibility(run) {
  if (!run.testCase) return 'case definition missing';
  if (run.manifest.exitCode !== 0) return `harness exit ${run.manifest.exitCode}`;
  if (run.manifest.grading.notEvaluated !== 0) return `${run.manifest.grading.notEvaluated} assertions not evaluated`;
  if (typeof run.manifest.totalTokens !== 'number') return 'token usage missing';
  if (!COSTLESS_HARNESSES.has(run.manifest.harness)
    && typeof run.manifest.costUsd !== 'number' && typeof run.manifest.costCredits !== 'number') return 'cost usage missing';
  if (['control', 'policy'].includes(run.manifest.condition)) {
    if (accessedAmbientSkill(run.transcript)) return 'ambient installed skill accessed';
    const reports = suiteReportsProducedIn(run.runDir, run.fixtureDir);
    if (reports.length) return `suite checker report in a ${run.manifest.condition} workspace: ${reports.join(', ')}`;
  }
  return null;
}
