# Hoisting one rule: 2 of 9 to 5 of 8, and nothing else improved

The first change this suite has made to a skill on evidence and then
measured. "Run what you can" moved from item 6 of a discipline list near the
end of `engineering-assessment/SKILL.md` to **step 0 of the workflow**, with
a required "What I ran" section. Skill arm re-run on all three cases, three
trials each, same harness and model. Control and policy stage nothing from
the skill and were not re-run.

## The targeted assertion

`tooling-evidence` — did the assessment run a command and record its output,
rather than reason about it?

| Case | before | after |
|---|---|---|
| cited-risks | 0/3 | 1/3 |
| retry-storm | 2/3 | 2/2 |
| silent-drop | 0/3 | 2/3 |
| **total** | **2/9** | **5/8** |

Moving one sentence roughly tripled compliance. At n=8 that is suggestive,
not settled — a Fisher exact on 2/9 against 5/8 sits around p≈0.07 — but the
direction matches the diagnosis, and the diagnosis was made before the
change rather than after it.

## Everything else stayed noisy

Total scores, skill arm, before → after:

| Case | before | after |
|---|---|---|
| cited-risks (of 7) | 4.33 | 5.00 |
| retry-storm (of 8) | 6.67 | 5.50 |
| silent-drop (of 8) | 5.00 | 6.00 |

Two up, one down, and the spread inside each condition is wider than the
gap between them — silent-drop returned 8, 3, 7 on identical inputs. **The
hoist bought compliance on the rule it targeted and no general improvement.**
Anyone reading this as "the skill got better" is reading past the variance.

## One run was excluded, correctly

retry-storm trial 2 returned exit 0 with 522,303 tokens and an API `529`.
The environment-failure matcher added this morning caught it and recorded
all eight assertions as `not_evaluated`. Before that fix it would have
scored 0/8 and dragged the after-mean down by nearly a point — a fabricated
regression in the exact experiment measuring an improvement.

## Provenance

Bundles now carry `stagedInputSha256`, a hash of the `.agent-input` tree.
Pre-change skill runs show `legacy` (the field did not exist); post-change
runs all show `482b5534`. Without it these eighteen runs would sit in
`eval/runs` indistinguishable from each other, and this comparison would be
unreproducible by anyone who was not present for it.

## Standing

Unchanged: no promotion. The codex cohort is still empty on all three cases,
and the efficiency breach from the previous run is untouched. What this adds
is one measured skill improvement, honestly bounded — and a working method
for making more of them.
