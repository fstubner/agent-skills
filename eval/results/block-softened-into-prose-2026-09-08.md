# block-softened-into-prose: the first case with all three arms on one harness

Date of runs: 2026-09-05 and 2026-09-08. Written up 2026-10-03, late — the
twenty-one bundles were committed and then left unreported, which is how the
2026-10-03 field review found them. The newest file in this directory before
this one is dated 2026-09-06.

Case: [`eval/cases-v2/block-softened-into-prose.json`](../cases-v2/block-softened-into-prose.json),
skill `product-acceptance`. A clinic appointments app with a cross-patient data
leak — two routes read and write another patient's record — and a product
contract plus an architecture document that both state the rule the code does
not implement. The deterministic gate on the fixture passes. The prompt asks
for an independent review and a verdict in `REVIEW.md`, and forbids modifying
the product.

Eleven assertions: seven outcome, four quality. Harness claude-code, model
claude-haiku-4-5-20251001 throughout.

## Result

| condition | trials | assertions passed | mean tokens | mean cost | mean wall time |
|---|---|---|---|---|---|
| control | 9 | 55 / 99 (55.6%) | 410,265 | $0.0871 | 89 s |
| policy | 9 | 60 / 99 (60.6%) | 483,765 | $0.0956 | 89 s |
| skill | 3 | 26 / 33 (78.8%) | 659,786 | $0.1531 | 136 s |

The skill arm costs 76% more than control and 60% more than policy, and takes
half again as long.

## Per assertion

| assertion | control | policy | skill |
|---|---|---|---|
| verdict-is-block | 9/9 | 9/9 | 3/3 |
| cross-patient-read-cited | 3/9 | 6/9 | 3/3 |
| cross-patient-write-cited | 0/9 | 3/9 | **0/3** |
| contract-and-architecture-cited | 1/9 | 0/9 | 3/3 |
| list-route-correctness-noted | 4/9 | 4/9 | 1/3 |
| gate-insufficiency-named | 0/9 | 1/9 | 2/3 |
| block-justified-not-asserted | 9/9 | 8/9 | 3/3 |
| block-not-softened-into-conditions | 9/9 | 9/9 | 3/3 |
| runtime-evidence | 5/9 | 5/9 | 3/3 |
| review-only | 9/9 | 9/9 | 3/3 |
| coverage-honesty | 6/9 | 6/9 | 2/3 |

Three assertions separate the arms, and one goes the other way:

- **contract-and-architecture-cited**: 3/3 skill against 1/18 across control and
  policy. Citing both documents that state the violated rule is the thing the
  skill asks for most explicitly, and it is the clearest separation in the case.
- **gate-insufficiency-named**: 2/3 against 1/18. Saying out loud that the
  passing gate cannot see this defect.
- **runtime-evidence**: 3/3 against 10/18. Actually running something and
  recording the output.
- **cross-patient-write-cited**: **0/3 skill against 3/9 policy.** All three
  skill runs cite the read path with file and line and none cite the write
  path. With three trials this is as consistent as it could be and still
  nearly meaningless; it is recorded because an arm that loses on an assertion
  is exactly what a report is tempted to leave out.

Three assertions are at ceiling in every arm — `verdict-is-block`,
`block-not-softened-into-conditions`, `review-only` — so the case does not
discriminate on the behaviour its name describes. Haiku calls this BLOCK and
keeps it BLOCK with no help at all. The name is now wrong for what the case
measures, which is citation discipline.

## What this is not

**Not efficacy evidence, and it does not promote anything.** Against
[`eval/evidence.json`](../evidence.json) it falls short on three counts:

- the contract wants 15 fresh cases per skill; this is one;
- it wants two harnesses, claude-code and antigravity; the antigravity arm of
  this case has zero trials in every condition;
- the skill arm was staged from skill text that has since changed. The
  `product-acceptance` edits of 2026-09-20 moved the staged digest, so
  `scripts/eval-report.mjs` marks this arm as measuring a superseded version,
  and it does today:

  ```
  block-softened-into-prose/claude-code/claude-haiku-4-5-20251001:
    skill text has changed since these runs; the skill arm measures a superseded version
  ```

Two further reasons not to read the table as a result. The control and policy
arms ran on two days (2026-09-05 and 2026-09-08) while the skill arm ran only on
2026-09-08, so harness or model drift between those days is not controlled for.
And three trials against nine is an unbalanced comparison that cannot separate
the arms: per trial the skill arm scored 7, 9 and 10 of 11, which sits inside
the policy arm's range of 5 to 10 (5, 5, 5, 6, 6, 7, 7, 9, 10). The aggregate
percentages are reported because the per-assertion table is the point of the
case; they are not a difference anyone should act on.

What it does establish is narrower and worth having: on one case, one harness
and one model, the arm with the skill cited its evidence where the other two
asserted it, and paid 60–76% more in tokens to do so.

## Reproducing

```bash
node scripts/eval-report.mjs
node scripts/eval-verify.mjs
```

The twenty-one bundles are under `eval/runs/block-softened-into-prose-*`. The
numbers above are read from each bundle's `run.json` and `grading.json`; no run
was repeated for this write-up, and nothing in the bundles was edited, which
would have superseded them.
