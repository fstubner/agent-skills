# Delivery: does a skill reach context at all?

Design sketch, 2026-08-31. Nothing here has been run. Written after the
selection harness produced a number that reframes the problem.

## The gap this exists to close

Two measurements now sit side by side:

| | measured | how |
|---|---|---|
| **selection** — asked which skill fits, does the model pick the right one | **138/159, ~87%** | `scripts/eval-invocation.mjs`, 2026-08-31 |
| **invocation** — unasked, does a skill fire in a real session | **~0%** | unprimed protocol, both recorded runs, 15 skills installed |

Deployed value is the product of the two. The model routes well when asked
and never asks, so the binding constraint is delivery, not description
wording. That is why description tuning has little left to give: today's
attempt recovered `mental-models` from 0/3 to 3/3 and moved overall top-1 by
one trial, because there was only 13% of headroom to begin with.

`~0%` is also the weakest number in this repository. It rests on two runs
scored by hand from transcripts. Before spending anything on improving
delivery, it needs to be measured properly — automated, repeatable, and
cheap enough to run as a matrix.

## What to measure

For a single task prompt in a workspace with skills installed: **did any
skill's content enter the model's context before it started work, and was it
the right skill?**

Detectable from `claude -p --output-format json`, whose transcript records
tool calls. A skill fired if the transcript contains either a `Skill` tool
call naming an installed skill, or a `Read` whose path ends in a
`SKILL.md` under the install root. Both are unambiguous and neither needs a
judge.

Three outcomes per trial, and the middle one matters as much as the first:

- `fired-correct` — the intended skill's content entered context
- `fired-wrong` — some other skill did, which is a routing cost, not a win
- `silent` — nothing fired

Scored against the same `expected` labels the selection harness already
uses, so selection and delivery are directly comparable on identical
prompts.

## Arms

Factorial over how the suite is presented. Each arm is a workspace fixture;
the task prompts and the model are held constant.

| arm | workspace | question it answers |
|---|---|---|
| **A** installed only | skills in the install root, nothing else | the honest baseline — reproduces the ~0% figure automatically |
| **B** + listing hook | a SessionStart hook injecting names and descriptions | does the router fire when the menu is in front of it, rather than on disk |
| **C** + standing instruction | `AGENTS.md`/`CLAUDE.md` line telling the agent to check installed skills before starting | does one sentence of policy do what the hook does, for no context cost |
| **D** + dispatcher | `product-build` installed and named in the instruction | does routing-through-one-skill beat routing-through-seventeen |

A vs B separates "the descriptions are wrong" from "the descriptions were
never read" — and the selection result already predicts B should be close to
87% if delivery is the whole problem. If B lands far below 87%, something
other than visibility is wrong and the plan changes.

B vs C is the one with a real deployment consequence: a hook costs context
on every session forever, a sentence costs almost nothing, and if they
perform the same the hook should not ship.

D tests the shape the suite is actually built around, since `product-build`
already exists as a dispatcher. If D beats B, the answer is one loud skill
rather than seventeen quiet ones — which is also the tiered-install question
from the design review.

## What it costs

Unlike the selection harness, each trial is a full agent run: the model
works the task, so cost and wall clock are comparable to an efficacy run
(~62s median, ~325k tokens on Haiku, from the 142 recorded claude-code
bundles). A first cut of 12 prompts x 4 arms x 3 trials is 144 runs — the
same order as the 139 claude-code runs already recorded, which cost $11.23
imputed and are flat-rate on a Max plan.

That is affordable, but it is not free the way the selection harness was, so
it is worth cutting the prompt set to the skills whose delivery matters most
rather than running all 61.

## Traps to avoid

**Do not let the task prompt name a skill.** The prompts must be the same
scenario-shaped prompts the selection harness uses. A prompt that says
"review this" to a suite containing `product-acceptance` is a fair trigger;
one that says "use the acceptance skill" measures nothing.

**A fired skill is not a followed skill.** This measures delivery only.
Whether the content then changes the output is the efficacy programme's
question, and conflating them is the mistake `eval/README.md` already warns
about. Report the two separately and never multiply them into a single
headline.

**The hook arm changes the system prompt for every task**, including tasks
no skill should serve. Carry the distractor prompts through, and count a
skill firing on `"Rename the utils folder to lib"` as a cost. An arm that
fires 100% of the time has not solved routing, it has removed it.

**Arms B, C and D each add context**, so any efficacy difference between
arms is confounded with context length. Do not read output quality across
arms; read firing rate only.

## What would make this unnecessary

If the answer is that skills only ever reach context through explicit user
invocation — `/skill-name`, or a harness that always injects them — then the
efficacy programme is measuring the right thing under the right assumption,
and this experiment just documents that assumption instead of testing a way
around it. That is a legitimate outcome and should be written into
`AGENTS.md` either way, since it is currently unstated.
