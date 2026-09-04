# Which assertions have ever moved?

2026-09-04. No new runs. Every case in the measured programme, scored against
every archived bundle by its current grader (`scripts/eval-regrade.mjs`), asked
one question: has this assertion ever landed differently in any arm of any
trial?

| skill | assertions scored | never pass | always pass (excl. integrity guards) |
|---|---|---|---|
| product-acceptance | 136 | **28** | 9 |
| engineering-assessment | 146 | 7 | 23 |

An assertion that never passes does not bias a skill-vs-control delta — it is
zero in both arms. What it does is make the programme smaller than its case
files claim. product-acceptance's 11.0pp rests on a live set roughly a fifth
smaller than it looks.

## The systematic one: `declared-commands-run`

Never passes in six engineering-assessment cases. Not a grader defect.

`scripts/eval-run.mjs:114` invokes claude-code with
`--permission-mode acceptEdits`, which permits file edits and **not** command
execution. Codex runs get `--dangerously-bypass-approvals-and-sandbox` and can
execute. So for the entire claude-code arm — the completed arm, the one every
current number comes from — running the declared test command is impossible,
and the reports say so plainly:

> `npm test` | Approval required — not executed. Can verify the test file
> exists and has structure: single unit test for rate-limit under-limit case

That is a model behaving correctly under a constraint, scored as a failure.

It is the same error this project already wrote a rule against — "a run that
never reached a model is not a failing run" — one level down. The rule was
applied to runs and never to assertions.

Two ways out, and they are not equivalent:

- **Let the runs execute the declared command.** The fixtures are ours, so
  there is nothing unsafe about it, and the skill genuinely instructs running
  declared commands — that is a thing worth measuring. Costs a re-run.
- **Score it `not_evaluated` where the harness cannot execute.** Cheaper and
  honest, but it concedes that a rule the skill teaches is never measured on
  the arm that carries the evidence.

Not decided here. It changes what every future run can do.

## The mis-specified case: `clean-build-with-open-items`

Four of its ten assertions never pass, including the one the case is named
for. `verdict-is-conditional` is **0 of 9** — every run in every arm returned
BLOCK or SHIP, never CONDITIONAL.

Reading the fixture, the runs look right and the case looks wrong:

    app.post('/api/sign-in', (req, res) => {
      req.session.staffId = req.body.staffId;
      res.json({ ok: true });
    });

Any client can claim to be any member of staff. PRODUCT.md says "Everyone
signs in with a staff account" and nothing delegates authentication elsewhere.
A reviewer who blocks on that is not over-reporting.

Its harm guard `no-fabricated-findings` is 0 of 9 for the same reason. It
lists six patterns as things "NOT true of this build", and four of them are
true of it: sign-in has no validation, the session secret falls back to
`'change-me'`, cross-user access is reachable through impersonation, and
`id: bk${length + 1}` reuses an id after a cancellation. Two are genuine
fabrications — double booking is refused by `create` and covered by a test, and
the tests do cover error paths.

Its comment says hedged mentions are excluded. They are not: the patterns are
tested against the whole report, not sentence by sentence, so "no evidence of
data loss" trips the data-loss pattern.

This one is not patched here. Whether the fixture should lose its auth hole so
CONDITIONAL is right, or the case should expect BLOCK, is a design decision
about what the case is for, and patching the grader underneath either answer
would be polishing the wrong thing.

## The rest of the never-passing set

product-acceptance, by case:

    checker-crash-read-as-pass              5 of its assertions
    clean-build-with-open-items             4
    frontend-without-its-artifacts          4
    narrowed-audit-across-a-trust-boundary  3
    refresh-mid-flow-loses-work             3
    builder-self-assessment-in-the-repo     2
    seven further cases                     1 each

Five cases with three or more unsatisfiable assertions is not a run of bad
luck. Each needs the treatment the five engineering-assessment harm guards got
today: read what the reports actually say, then decide whether the assertion,
the grader, or the case is wrong. None of it needs a new run.

## What today established about the method

Every defect found today — five false-positive harm guards, one stem bug, one
permission constraint, one mis-specified case — was found by scoring archived
`outputs/` directories. Nothing was re-run to find any of it.

The programme has 700-odd bundles sitting on disk and had never been asked
whether its instruments read them correctly.
