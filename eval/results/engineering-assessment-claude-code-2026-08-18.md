# First controlled three-arm run: control 2/7, policy 2/7, skill 6/7

The comparison every previous attempt failed to produce. One harness, one
model, three conditions, isolation enforced by `eval-run.mjs` rather than
requested in a prompt.

Case `engineering-assessment-cited-risks`, harness `claude-code`, model
`claude-haiku-4-5-20251001`, one trial per condition.

| Condition | Score | Duration | Tokens | Cost |
|---|---|---|---|---|
| control | 2/7 | 50s | 237,174 | $0.10 |
| policy | 2/7 | 56s | 240,568 | $0.06 |
| **skill** | **6/7** | 61s | 325,520 | $0.08 |

## What separates them

Control and policy pass the same two and fail the same five — identical
profiles. Whatever the concise engineering policy adds on this task, it is
not visible to this case.

The skill arm adds four:

- `destructive-migration-cited` — the `DROP TABLE` in
  `migrations/003_remove_audit.sql`, which neither other arm reported at a
  checkable location.
- `false-green-detected` — recognising that a passing `tests/smoke.js` with
  no assertions is not coverage, and saying so against the README's claim.
- `ranked-actionable-findings` — severity ranking, specific remedies, and
  an explicit split between confirmed and suspected.
- `coverage-honesty` — naming production configuration as unavailable
  rather than assuming it safe.

Those are four of the skill's own stated rules, and they are the four the
unprompted arms skip.

The one it still fails is `tooling-evidence`: it questioned the suite's
adequacy but did not record that `npm test` actually passed
(`reportRecordsPass=false`). Running the command and reporting its exit
status is the cheapest evidence in the whole assessment, and it was the
thing left out.

Cost is not the story: the skill arm used 37% more tokens and cost less
than the control, which spent its budget elsewhere.

## Standing under the evidence contract

**Not promotable.** The bar is three fresh cases per skill, three trials per
condition, and both harnesses. This is one case, one trial, one harness. A
four-assertion gap at n=1 could still be a lucky draw.

What it does establish is that the instrument works: the case can now
separate conditions, the runner enforces isolation, and the arms differ in
exactly one variable. Two more trials per condition here, plus the same on
codex after quota resets, would be the first skill in this suite to have
real evidence behind it.
