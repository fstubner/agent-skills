# Eval

Two separate questions live here, tested with two different protocols —
conflating them is the single easiest way to draw a wrong conclusion from
this directory.

1. **Invocation**: does a skill get used at all, unprompted? Tested with
   the **unprimed** protocol below.
2. **Efficacy**: given a skill's content is actually in front of the model,
   does following it produce a better result? Tested with the **forced**
   protocol below. A forced run is NOT evidence about invocation — it
   deliberately bypasses the question the unprimed protocol answers.

**Status, invocation (unprimed):** 3 cases exist (`okr-tool`,
`csv-stats-cli`, `product-doc-injection`); only `okr-tool` has recorded
runs, and both are negative. See
`results/okr-tool-claude-code-claude-sonnet-5-r1.json` (Task-tool subagent)
and `-r2.json` (genuine top-level `claude -p` session). Both had all 15
skills installed from tag `v1.0.0-alpha.1`; neither invoked a single skill
on a prompt matching `product-build`'s own trigger. 1 of 5 criteria passed
in each run (`stack`) — the rest failed because no skill fired at all, not
because a fired skill's guidance was wrong. `csv-stats-cli` and
`product-doc-injection` exist to cover skill areas `okr-tool` never
touches (cli-tooling/testing-strategy, and the prompt-injection stance in
product-build/product-acceptance) — neither has been run yet.

**Status, efficacy (forced):** 1 of 15 skills tested —
`systems-architecture`, `okr-tool`'s `architecture` criterion only, 3 reps
per arm, Haiku. See `results/okr-tool-claude-code-claude-haiku-4-5-*-r*.json`
(`control` = unprimed baseline, `forced` = the skill's actual `SKILL.md`
content and checker mandated). Result: 0/3 control vs. 3/3 forced,
independently verified by re-running `systems-architecture/scripts/check-architecture.js`
against every project rather than trusting either agent's self-report. The
other 14 skills have never been efficacy-tested — this is one data point,
not a general finding that "the skills work when followed."

Read every `notes` field before drawing conclusions — see the honesty rule
in the root README. Do not cite a passing checker-fixture test as evidence
this directory doesn't also apply to it.

## Protocol: unprimed (invocation)

1. Fresh session, empty project, skills installed from a tag, no priming
   (the case's `setup` block is the contract — violating it invalidates the
   run).
2. Paste the case `prompt` verbatim. Let the agent work.
3. Score each `scoring` criterion pass / fail / not_evaluated from the
   transcript. Scores are human judgment; keep the transcript so others can
   re-score.
4. Save as `results/<caseId>-<harness>-<model>-r<n>.json` matching
   `core/schemas/eval-result.schema.json`, `condition` omitted or set to
   `"unprimed"` (CI validates shape, not truth).

## Protocol: forced (efficacy)

Isolates "does following this guidance help" from "will the model choose
to follow it" — the two are independent, and only forcing the content in
front of the model removes the second variable.

1. Fresh session, empty project, skills installed from a tag. Explicitly
   instruct the agent to read one specific skill's real `SKILL.md` (by
   absolute path) and follow it as a hard requirement, including running
   any checker script it points to, before implementing.
2. Paste the case `prompt` verbatim as the rest of the task. Run a matched
   unprimed control (same prompt, same model, no skill mentioned) for
   comparison — a forced run alone proves nothing without a baseline.
3. Score the specific criterion the forced skill targets against an
   independent verifier where one exists (re-run the skill's own checker
   script against the resulting project — do not trust either agent's
   self-report of what it built). Criteria outside the forced skill's scope
   are usually `not_evaluated`, not scored — don't claim coverage a
   single-skill forced test didn't test.
4. Run 3+ reps per arm before drawing a conclusion — a single run is noise,
   not signal.
5. Save as `results/<caseId>-<harness>-<model>-<control|forced>-r<n>.json`,
   `condition` set to `"forced"` for the forced arm (control runs are
   `"unprimed"` — they're a real unprimed baseline, just recorded alongside
   a forced-condition experiment instead of the invocation study above).

A criterion you didn't observe is `not_evaluated`, not `pass`.
