# Eval

This directory measures whether the skills make an agent's work better. No
skill has met the promotion bar below yet.

## Running it

```bash
node scripts/eval-verify.mjs
node scripts/eval-run.mjs --case cli-csv-statistics --condition control --harness claude-code --model <model>
node scripts/eval-report.mjs
```

Each run copies a fixture into a temporary workspace, records the exact
prompt and the harness's raw output, snapshots what the agent produced and
grades it with the case's outcome grader. It also records timing, tokens and
cost where the harness reports them, and hashes the case, fixture, grader,
skill text and output. Changing any of those inputs retires the runs that
used them.

**Thirteen graders run the model's output on your machine without a
sandbox.** They import the `server.js` it wrote, start it on a loopback port
or run `npm test` in the workspace. That's the only way to check whether, say,
a refund endpoint refuses a request from another account. It means a run has
the same access as whoever starts it. Graders that only read prose never run
anything.

To run Codex inside a filesystem sandbox you enforce yourself, set
`AGENT_SKILLS_OUTER_SANDBOX=1` and pass `--codex-external-sandbox`. Skill and
checker inputs are then copied into `.agent-input/` in the workspace and left
out of grading. Don't use this flag from a process that isn't sandboxed.

`scripts/eval-import-projectless.mjs` imports tasks run in the Codex desktop
app without a project. It ties the rollout to the task id, copies the
deliverables, re-runs the grader and writes the same hash-bound manifest a CLI
run gets.

## What counts as evidence

Every case compares three conditions. `control` has no guidance, `policy`
has a short concise-style policy, and `skill` has the skill itself. Nine cases
add a `checker` condition. The main comparison is `skill` against `policy`,
fixed in advance. `control` is reported alongside it, and the baseline is
never picked after seeing the results.

The assertions in a case form one rubric, so they aren't counted as separate
samples. Trials are averaged within each case, harness and model, then across
harnesses and models within the case, and the case is the unit of analysis.
That stops a long rubric or a bigger model matrix from counting for more.

[`evidence.json`](./evidence.json) sets the bar for promoting a skill.

- 15 fresh cases per skill, each with every condition run.
- 3 trials per condition.
- Both required harnesses, Claude Code and Antigravity, with the models
  listed there.
- A two-sided 95% Student-t interval showing either at least a 10 point
  improvement in outcome, or at least a 10% drop in resources with outcome no
  more than 2 points worse.

A point estimate alone can't promote a skill, and a case file with no runs
isn't evidence. CI rejects any change to `evidence.json` that lowers these
thresholds.

Three skills are being measured, `engineering-assessment`,
`product-acceptance` and `release-engineering`. `node scripts/eval-report.mjs`
shows where each one stands.

## Invocation and efficacy

These are separate questions with separate methods, and mixing them up is
the easiest way to misread this directory.

- **Invocation** asks whether a skill gets used without being asked for. It's
  measured from real session transcripts, most recently in
  [field-outcomes-2026-10-03.md](./results/field-outcomes-2026-10-03.md), and
  from unprimed runs.
- **Efficacy** asks whether the work is better once the skill is in front of
  the model. That's what the runs above measure.

## Older results

`results/` also holds observations from before the current method. They
aren't evidence either way. Their cases are loosely defined, their provenance
is incomplete, most were run once, and none have complete transcripts,
outputs and cost records. The full-suite batches are in
[five-skill-batch-2026-08-02.md](./results/five-skill-batch-2026-08-02.md) and
[full-suite-batch-2026-08-02.md](./results/full-suite-batch-2026-08-02.md).

Two older protocols produced the `results/*.json` files, which are checked
against `core/schemas/eval-result.schema.json`.

### Unprimed (invocation)

1. Start a fresh session in an empty project with the skills installed from a
   tag and no priming. The case's `setup` block is the contract, and breaking
   it invalidates the run.
2. Paste the case `prompt` as written and let the agent work.
3. Score each `scoring` criterion as pass, fail or not_evaluated from the
   transcript, and keep the transcript so others can re-score it.
4. Save it as `results/<caseId>-<harness>-<model>-r<n>.json`, with `condition`
   left out or set to `"unprimed"`.

### Forced (efficacy)

The task must match the skill's own trigger. Before running, quote the
trigger from the skill's `description`, say which part the task exercises and
which part it doesn't. A null result on a task the skill says it isn't for
says nothing about the skill (see
[CORRECTION-2026-08-02-underpowered-nulls.md](./results/CORRECTION-2026-08-02-underpowered-nulls.md)).

1. Start a fresh session in an empty project with the skills installed from a
   tag. Tell the agent to read one skill's `SKILL.md` by absolute path and
   follow it as a hard requirement, including any checker it names.
2. Paste the case `prompt` as the rest of the task. Run a matching control
   with the same prompt and model and no skill mentioned.
3. Score the criterion the skill targets with an independent check where one
   exists, such as re-running the skill's checker on the result. Mark criteria
   outside the skill's scope `not_evaluated`.
4. Run at least three repetitions per arm before drawing a conclusion.
5. Save it as `results/<caseId>-<harness>-<model>-<control|forced>-r<n>.json`,
   with `condition` set to `"forced"` for the forced arm and `"unprimed"` for
   the control.

A criterion you didn't observe is `not_evaluated`, not `pass`.
