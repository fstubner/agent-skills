# Narrowing what gets measured, not what ships

At 15 cases a skill, measuring all seventeen is 255 cases. That is not a
programme anyone is going to run. The affordable move is to narrow which skills
carry a measurement obligation, and to say plainly that the rest are
unvalidated.

## What was NOT done

No skill was deleted. Deleting and not-measuring are different acts, and
conflating them would trade working behaviour for a smaller number.
`data-modeling` is invoked once in a month of telemetry, and its checker is
what blocks a destructive migration reaching a review. Rarely called is not the
same as not worth having.

## Selection criteria, fixed before looking at who wins

1. Real usage outside this repository.
2. Measurable at all — a deterministic checker, or existing case investment.
3. A distinct failure mode a case can express.

Deliberately **not** a criterion: how well a skill scored. Selecting on measured
effect would bias whatever the retained set later reports, which is the same
trap as reweighting a rubric after seeing which assertions moved.

## The evidence behind it

Telemetry over 2026-08-03 to 2026-08-30: 511 invocations across 36 sessions and
16 projects. Only 35 of those were inside `agent-skills` itself, so 93% is real
use on other work rather than self-reference.

| skill | invocations | checker | cases |
|---|---|---|---|
| product-acceptance | 258 | yes | 4 |
| engineering-assessment | 48 | – | 4 |
| product-build | 30 | – | 3 |
| frontend | 24 | yes | 2 |
| ai-prose-slop | 21 | yes | 1 |
| release-engineering | 21 | yes | 2 |
| code-smells | 16 | yes | 1 |
| *(ten more)* | ≤12 | mixed | ≤2 |

## The programme

`measuredSkills` in `eval/evidence.json`, required by its schema:

    product-acceptance       258 invocations, checker, 4 cases
    engineering-assessment    48 invocations, 4 cases, the only completed matrix
    release-engineering       21 invocations, two checkers, the operate half

Three skills at 15 cases each is 45, of which 10 exist and 35 remain — against
255 and 225 before. Still substantial, and now finite.

`product-build` and `frontend` were the hardest omissions: both are used more
than `release-engineering`. `product-build` has no checker and is a routing
skill whose output is other skills' artifacts, which makes a clean case hard to
write. `frontend` has a checker but its cases turn on visual judgement — the
`design-system-drift` pilot showed the base model already handles the
extraction task well. Both can enter the programme later; entering is cheap,
and leaving after seeing results would not be.

## What the other fourteen now report

`not-measured`, rather than `insufficient-evidence`. The old label implied
someone was collecting evidence. Nobody is, and saying so is the honest
position — the same one `INSTALL.md` already takes about the suite as a whole.

## Two fixes this dragged out

The suite's schema validator refuses keywords it has not implemented rather
than skipping them, and it caught `uniqueItems` on the new field. Implemented,
with mutation tests including value-comparison of objects.

`eval-report` treats an absent `measuredSkills` as "measure everything", so a
synthetic eval root passed through `--eval-root` still works. The real contract
is held to declaring the list by its schema.
