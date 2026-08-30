# The skills work on the rules they state; the aggregate hides it

Pooling each assertion id across every case that declares it — which
`eval-report` never did, because it classifies assertions only within one
case/harness/model block — shows large, significant, monotonic effects that the
promotion metric averages away.

Reproduce with `node scripts/eval-assertion-rollup.mjs`.

## The effects

Skill arms restricted to the current skill text; 67 superseded runs excluded.
The `cases` column counts cases contributing eligible runs, not cases declaring
the assertion — `coverage-honesty` is declared by six and scored in five.

| assertion | cases | control | policy | skill | one-sided P |
|---|---|---|---|---|---|
| ranked-actionable-findings | 4 | 3% | 3% | **67%** | <0.00001 |
| tooling-evidence | 3 | 17% | 22% | **81%** | 0.00001 |
| verdict-is-block | 2 | 0% | 0% | **42%** | 0.0017 |
| help-contract | 1 | 0% | 0% | 100% | 0.0023 |
| destructive-migration-cited | 1 | 17% | 17% | 89% | 0.0026 |
| missing-artifacts-cited | 1 | 0% | 0% | 67% | 0.0031 |
| source-untouched | 1 | 17% | 0% | 100% | 0.0041 |
| scope-and-tooling-honest | 1 | 0% | 0% | 50% | 0.023 |
| coverage-honesty | 5 | 22% | 38% | **64%** | 0.027 |

Every row is monotonic control → policy → skill. The concise-policy baseline
moves a little; the skill moves a lot. That is what a dose response looks like,
and it is not what a length artefact looks like — a longer document does not
make `source-untouched` true.

## Why the promotion metric does not see it

Of 73 assertions with at least six graded runs:

    skill beats policy, P < 0.05    16
    skill exactly equals policy     25
    skill scores below policy       14
    at ceiling in both arms         15

    mean pass rate   control 0.461   policy 0.473   skill 0.629

The promotion metric averages a case's whole rubric. Twenty-five assertions
where the skill changes nothing and fifteen already at ceiling are averaged
together with sixteen where it changes a great deal, and the result is an
outcome delta that does not clear the bar.

Both facts are true at once and neither cancels the other:

- **The skills change specific behaviours, strongly and reproducibly.**
- **They do not raise the whole-rubric average enough to promote.**

## What this does not license

Reweighting the metric toward the assertions that moved would be picking the
scoring rule after seeing the scores. `eval-report`'s existing diagnostic says
this in its own comment, about the per-block version of the same temptation:
dropping assertions after seeing results is how a bar gets moved to fit the
data. That applies here with more force, because the pooled view makes the
flattering subset easy to name.

So nothing about the promotion contract changes on the strength of this. What
changes is what is worth arguing about, and there is a real argument now:
whether a rubric should contain assertions the skill under test never claims to
affect. Fifteen assertions at ceiling in both arms measure the base model, not
the skill. That case can be made honestly — but it has to be made about the
CONTRACT, in advance, and applied to cases not yet run.

## How this was nearly missed

This came out of a challenge to a plan I had already started executing. A
rubric-based LLM instrument had found `statesScopeLimits` at 6/8 versus 2/8 and
`verdictStated` at 8/8 versus 5/8, both around P = 0.11, and I was about to
spend roughly 250 judge calls confirming them across fifty pairs.

The deterministic graders already held the answer, on more runs, with larger
effects, at evidence grade rather than `evidentiary: false`. The LLM rubric was
a useful hypothesis generator — it pointed at honesty and verdicts — and a poor
measuring instrument for something regexes had already measured.

The general form: before spending on a new instrument, check whether the
existing evidence has been fully read. Three hundred and ninety-three run
bundles had been sitting there with this in them.

## Caveats

- Normal-approximation two-proportion tests on small cells. Indicative, not
  decisive, and no correction is applied for testing 73 assertions — at that
  count roughly four rows would clear P < 0.05 by chance alone, so the tail of
  the table is weaker than the head.
- Pooling an id across cases assumes it means the same thing in each. For
  `coverage-honesty` across five cases and `ranked-actionable-findings` across
  four, that was checked by reading the graders; for single-case rows it is
  vacuous.
- Diagnostic only. This does not enter the promotion decision and no skill's
  status changes because of it.
