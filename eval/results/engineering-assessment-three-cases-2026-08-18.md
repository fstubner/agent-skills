# Three cases, 27 runs: the skill wins every one, and costs more than the contract allows

`engineering-assessment` now has three fresh cases with three trials per
condition on `claude-code` / `claude-haiku-4-5-20251001`. Every arm was run
by `eval-run.mjs` with isolation enforced.

| Case | control | policy | skill | skill vs policy | cost vs policy |
|---|---|---|---|---|---|
| cited-risks (of 7) | 2.00 | 2.00 | **4.33** | +33pp | +45% |
| retry-storm (of 8) | 3.33 | 3.67 | **6.67** | +38pp | +61% |
| silent-drop (of 8) | 2.67 | 2.00 | **5.00** | +38pp | +47% |

Three fixtures in three languages — Node, Python, Go — with three different
failure shapes: planted defects, a retry/idempotency trap, and an absence.
The skill arm wins all three by 33 to 38 percentage points against the
pre-specified policy baseline, well clear of the 10pp threshold.

## What actually reproduces

**Ranked, remediated findings with confirmed separated from suspected.**
Across all three cases: skill **8 of 9**, control **0 of 9**, policy
**0 of 9**. This is the single most reliable effect in the suite's history,
and it is the skill's own rule.

**Naming the absence.** In silent-drop, "there are no tests at all" is the
finding the fixture is built around: skill 3/3, control 0/3, policy 1/3.
Unprompted arms report what is present and rarely what is missing.

**Citing planted defects is not where the skill helps.** Control matches or
beats it on the obvious ones — `discarded-error-cited` 3/3 both,
`silent-skip-cited` control 3/3 against skill 2/3. Haiku finds visible bugs
without being told. The gap is entirely in the discipline around the
findings: ranking, remedies, honest scope, noticing absence.

## Three things that do not fit the story

**Cost breaches the contract.** The skill arm runs 45-61% more expensive
than policy, against an `efficiencyReductionRequired` of 0.1. On outcome the
skill promotes; on efficiency it does not. That is a real tension the
contract was written to force, and it should not be waved through.

**`tooling-evidence` is no longer uniformly zero, but it is close.**
retry-storm skill 2/3, everything else 0/3, and silent-drop 0/9 across every
arm. Nine more runs confirm the diagnosis from the first case: "Run what you
can" at line 217 of a 1,500-word file is mostly not followed.

**The policy arm is erratic.** retry-storm scored 2, 7, 2 — a seven on one
trial and a two on the others, from identical inputs. Its means are close to
control, but the variance means "policy ≈ control" is a weaker statement
than three matched numbers would suggest.

## Promotion status: still no

`eval-report.mjs` returns `insufficient-evidence`, `completedCaseCount: 0`,
because the contract requires **both** harnesses and the codex cohort has
zero trials on all three cases. Quota resets 2026-08-20. Nine runs per case
there would complete the matrix, and the efficiency question then has to be
answered rather than noted.
