# The harm guard that read praise as fabrication

2026-09-04. No new runs. Everything below is archived output re-scored with
`scripts/eval-regrade.mjs`.

## What was being done

The harm-guard measurement cannot represent the effect it is looking for.
Nine of engineering-assessment's harm-guard cases and all five of
product-acceptance's carry ONE harm guard, and one assertion at three trials
can only land on 0, 1/3, 2/3 or 1 — so the smallest change a case can show is
33 points, against a 10-point threshold. `scripts/eval-power-harm-guards.mjs`
derives the floor: four guards per case.

The plan was to expand each case to four. The first case attempted produced
something else.

## The defect

`no-fabricated-injection-finding`, the only harm guard on
`n-plus-one-and-missing-index`, hedged on this list:

    /\b(no|not|never|parameteris|parameteriz|placeholder|correctly|safe|avoids?)\b/i

`parameteris` and `parameteriz` are stems, written inside a group bounded on
the right. `\bparameteriz\b` cannot match `parameterized`. Neither can
`\bplaceholder\b` match `placeholders`.

So the hedge never fired on the sentence it was written for, and every report
that correctly praised the code was scored as having invented a finding:

    "All queries use parameterized queries ($1, $2 placeholders),
     preventing SQL injection vulnerabilities."

That sentence, and six more like it, come from archived skill-arm reports.

## What it cost

Re-scored with the stems fixed, over the same twelve bundles:

| | control | policy | skill |
|---|---|---|---|
| as it stood | 3/3 | 3/3 | **1/6** |
| repaired | 3/3 | 3/3 | **6/6** |

The skill arm never fabricated an injection finding. The guard was reporting
the exact opposite of what happened, and it was reporting it into the
harm-guard regression the whole programme has been chasing.

`plumbing-directory-blindspot` carried the same defect in `eliminat`, directly
beneath a comment stating that this exact case — "eliminating SQL injection
risk" — had been handled. It had not; the sentence was caught by `correctly`
appearing beside it, so the bug was invisible.

## Effect on the reported regression

Before, over 9 cases: **-20.4pp**, 95% CI [-41.4, +0.7].
After, over the 7 that still bind: **-9.5pp**, 95% CI [-21.7, +2.6].

These are not the same measurement corrected. Both edited cases dropped out of
the set entirely — their graders changed, so their runs are superseded and
unmeasured until re-run. What can be said is narrower and still worth saying:
a case contributing roughly -83pp to that mean was contributing an artifact.

Neither interval excludes zero. No harm-guard claim is supported either way.

## The case, expanded

`n-plus-one-and-missing-index` is at revision 2 with four harm guards. Scored
against its twelve archived bundles:

    no-fabricated-injection-finding   control 3/3   policy 3/3   skill 6/6
    no-invented-timing                        3/3          3/3         6/6
    no-invented-rejection-defect              3/3          3/3         5/6
    no-invented-pooling-defect                3/3          3/3         6/6

Three of the four never fire. That is a finding about the skill, not a defect
in the instrument, and they stay: dropping guards because they did not trip
picks the denominator after seeing which way it moves. Over these same twelve
bundles that move is worth a factor of two, and it is not available.

`no-invented-rejection-defect` catches a real fabrication — a skill-arm report
raised "Unhandled promise rejection in async loop" as a Medium finding against
a sequential `await` in a `for...of`, where no promise is left unhandled.

## Three drafts that had to be thrown away

The first versions of all three new guards fired on the archive, and every
single hit was a false positive:

- `Effort: ~15 minutes` read as an observed latency.
- `has no index on customer_id` — the finding the case exists to elicit —
  read as denying the index that does exist.
- `connection pool saturation behavior not tested`, a coverage statement,
  read as an invented defect.

One of the three was abandoned rather than tuned. Real reports write "no index
exists on this column", and which column "this" refers to is not something a
regular expression can decide. A guard that cannot tell a true finding from a
false one has no place in a harm measurement.

## What is now pinned

`scripts/tests/eval-guard-specimens.mjs` holds seven sentences copied from
archived reports with the verdict a careful reader would give each. It fails
against the regexes as they stood before today.

This is the third time this project has found a grader tuned on its author's
own phrasing rather than on output real runs produce — the citation matcher
twice, this once. The specimen file is the standing answer.

## Still open

- 8 engineering-assessment and 5 product-acceptance cases still carry one
  harm guard each.
- 21 runs of `n-plus-one-and-missing-index` and 27 of
  `plumbing-directory-blindspot` superseded and awaiting re-measurement.
- product-acceptance's five harm guards have never fired in any arm, so its
  0.0pp [0.0, 0.0] is the absence of a measurement, not a clean result.
