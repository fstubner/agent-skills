# Field outcomes: what happened when the skills were actually used

Date: 2026-09-02. Method: read the session stores of all four harnesses on the
author's machine, find every invocation of a suite skill in ordinary work, and
record who triggered it and what came next. Produced by
`scripts/skill-outcomes.mjs` for Claude Code; the other three harnesses were
searched by hand and the method for each is stated below.

This answers the question the 2026-08-16 telemetry report left open: the hook
could count invocations but could not say whether the human typed the skill's
name or the model chose it, and could say nothing about what came out.

## What this is and is not

It is field evidence about **delivery** (do the skills get reached for, and by
whom) and about **whether findings were acted on**. It is **not efficacy
evidence**: nothing here says what the model would have found without the
skill. That comparison is what `eval/` exists for, and this report makes no
claim it is not entitled to.

The author of the suite is also the only user in this data. Someone who wrote
the skills knows they exist and phrases requests that route to them. Read every
delivery number with that in mind.

## Claude Code

Source: every `.jsonl` under `~/.claude/projects`, excluding this repository's
own sessions and the eval harness's temporary workspaces. A resumed session can
carry its earlier turns forward, so a few rows appear twice; the counts below
are as extracted, duplicates included.

| | |
|---|---|
| invocations | 89 |
| projects | 15 |
| window | 2026-08-04 to 2026-08-30 |
| human typed the skill's name | 27 |
| model chose it | 62 |

Of the 62 the model chose, 41 followed a prompt that named the activity in
plain words ("run acceptance on legiblepapers", "do the product review
properly", "audit this product across all axes"). The remaining **21 followed a
prompt that did not name it at all**: "carry on with step 5", "merge it and
delete the branch", "we can tag the release, but are you certain we did
everything we set out to?". That last one routed to product-acceptance and
returned SHIP.

By skill: product-acceptance 26, engineering-assessment 22, ai-prose-slop 12,
code-smells 8, mental-models 8, frontend 6, product-build 4,
release-engineering 2, product-management 1. Eight of the seventeen skills do
not appear in a month of work.

### The acceptance gate's record

| verdict | runs |
|---|---|
| BLOCK | 11 |
| CONDITIONAL | 5 |
| SHIP | 2 |
| no verdict found | 8 |

The next thing the human typed after a BLOCK was, in 5 of 11 cases, a
specific fix: "fix the port 0 divergence", "fix the coupon redemption limit for
resubmissions", "fix the doctor PATH mutation and the stale lock", "fix the
empty write hole", "fix the disconnect bug and the walkthrough". Those are
defects named precisely enough that the human recognised them as real. It is
consistent with the gate finding real problems; it does not prove any
individual finding was correct, because a wrong BLOCK also gets "fix it".

In four separate sessions the human's reply after a verdict demanded that the
next acceptance pass run "in a new session", "in a subagent", "in a fresh
session" or with "independent subagents". The builder-is-not-the-acceptor rule
is being enforced by the person, which is the only way the README says it can
be. Of the two SHIP verdicts, one was answered with "are you certain? do we
have enough analytics to understand how users are using it".

engineering-assessment's 22 invocations were followed by a fix instruction 6
times, "continue" once, and something else 15 times. Assessments are read more
often than they are acted on in the same turn.

## Codex

Source: `~/.codex/sessions`, every `.jsonl` that reads a suite `SKILL.md`. 24
sessions do. 15 of them contain the eval harness's prompt marker and are runs
of `eval/`, not work. The 9 organic ones:

| when | project | skills read |
|---|---|---|
| Feb–Mar 2026 (3) | prism-graph | engineering-assessment, multi-agent-design |
| 2026-08-12 | agent-skills | code-smells |
| 2026-08-25 to 08-28 (4) | QueHay_Net | product-build, product-acceptance, release-engineering, frontend, engineering-assessment, backend-engineering, testing-strategy |
| 2026-08-26 | design-system | product-acceptance, release-engineering |

Codex has no first-class skill tool; a read of the file is the only signal, so
trigger and verdict were not extracted.

## Antigravity

Source: `~/.gemini/antigravity/conversations`, 163 SQLite stores, searched
with `strings`. Four mention a suite `SKILL.md`. Two are conversations about
this repository itself (installing it, listing its descriptions) and do not
count. The two organic ones are both prism-graph, 2026-08-07 and 2026-08-21,
both reading engineering-assessment and multi-agent-design.

## Cursor

Source: 44 chat stores under `~/.cursor/chats` and 182 workspace stores under
Cursor's `workspaceStorage`. No chat mentions a suite skill. The workspace
hits that a first search reported were directory names such as `frontend/` in
unrelated projects, not skill use. **Zero.**

## What changes

The README said unprompted invocation was measured at essentially never. That
measurement was two non-interactive `claude -p` runs with no human in the
loop, and it stands for that setting. In interactive sessions with a human,
over a month, the model chose a suite skill 62 times, 21 of them from a prompt
that named nothing. The unprimed-invocation question in
`eval/invocation/DELIVERY-SKETCH.md` (Q3, interactive versus `-p`) is
therefore answered in part by the field rather than by a probe: interactive
delivery works, at least for this user, and `-p` delivery does not.

Claude Code carries almost all of the use. Codex has a handful of real
sessions, Antigravity two, Cursor none. Whatever the suite's value is, it is
being realised in one harness.

## Reproducing

```bash
node scripts/skill-outcomes.mjs
node scripts/skill-outcomes.mjs --json
```

The other three harnesses were searched by hand; the commands are the obvious
`grep -l` over the paths named above, with the eval marker "Do not search for
or inspect evaluation cases" used to exclude harness runs from Codex.
