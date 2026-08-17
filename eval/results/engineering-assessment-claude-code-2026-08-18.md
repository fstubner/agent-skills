# Three trials per condition: control 2.00, policy 2.00, skill 4.33

Case `engineering-assessment-cited-risks`, harness `claude-code`, model
`claude-haiku-4-5-20251001`, three trials per condition, isolation enforced
by `eval-run.mjs`. The first comparison in this repository where every arm
differs in exactly one variable.

| Condition | Trials | Scores | Mean | Mean cost |
|---|---|---|---|---|
| control | 3 | 2, 2, 2 | **2.00** | $0.073 |
| policy | 3 | 2, 2, 2 | **2.00** | $0.062 |
| skill | 3 | 6, 4, 3 | **4.33** | $0.090 |

## Which assertions, and how reliably

| Assertion | control | policy | skill |
|---|---|---|---|
| default-credential-cited | 3/3 | 3/3 | 3/3 |
| path-traversal-cited | 3/3 | 3/3 | 2/3 |
| destructive-migration-cited | 0/3 | 0/3 | **3/3** |
| ranked-actionable-findings | 0/3 | 0/3 | **3/3** |
| false-green-detected | 0/3 | 0/3 | 1/3 |
| coverage-honesty | 0/3 | 0/3 | 1/3 |
| tooling-evidence | 0/3 | 0/3 | 0/3 |

Two effects are clean. **The destructive migration and the ranked,
remediated findings appear in every skill run and in none of the six
control or policy runs.** Those are the skill's own rules — cite the
`DROP TABLE`, rank by severity, split confirmed from suspected — and they
reproduce without exception.

Two are unreliable: naming the assertion-free smoke test as a false green,
and admitting production configuration was unavailable, each land once in
three. The skill asks for both; it gets them a third of the time.

One never lands anywhere: `tooling-evidence` wants the report to record
that `npm test` actually passed alongside the judgement that the suite is
inadequate. Nine runs, zero. Running the command and reporting its exit
status is the cheapest evidence in an assessment, and no arm does it.

The skill arm is also the *least* stable — 6, 4, 3 — while control and
policy return 2 every time. More instruction produced more variance, not
less. Worth watching rather than concluding from three points.

**The concise policy did nothing here.** Identical scores and identical
assertion profiles to the control across three trials, at slightly lower
cost. Whatever it buys on other tasks, this case cannot see it.

Cost is not an argument against: the skill arm averages $0.090 against the
control's $0.073, a 23% increase, inside the contract's 25% ceiling.

## Standing

**Not promotable.** The bar is three fresh cases per skill, three trials per
condition, *and* both harnesses. This is one case and one harness. Codex
arms are blocked until quota resets on 2026-08-20.

What is now true: this skill has one case where its effect is measured,
reproducible on two of its assertions across three trials, against a
baseline that never produces them. Two more cases and the codex cohort
would make `engineering-assessment` the first skill in this suite with
evidence behind it.
