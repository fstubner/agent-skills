# Field outcomes: what happened when the skills were actually used

Date: 2026-10-03. Window: 2026-08-04 to 2026-10-03. Method: the same as
[field-outcomes-2026-09-02.md](./field-outcomes-2026-09-02.md) — read the
session stores of all four harnesses on this machine, find every invocation of a
suite skill in ordinary work, record who triggered it and what came next.
`scripts/skill-outcomes.mjs` for Claude Code; the other three by hand, with each
method stated below.

Three things changed since the 2026-09-02 report, and all three change what the
numbers mean:

1. **Duplicates are removed.** A resumed Claude Code session copies its earlier
   turns into a new transcript, and a compacted one can repeat a turn inside a
   single file, so one invocation could be counted several times.
   De-duplicating on the `Skill` tool-call id — minted once by the API and
   copied verbatim — removes **13 of 140** rows: 7 across files, 6 within one
   file. Both the window and the de-duplication are now in the script rather
   than done downstream of it.
2. **Codex, Antigravity and Cursor now advertise a skill catalogue.** All three
   inject every installed skill's `SKILL.md` path into the system prompt. A grep
   for the path therefore matches almost every session, whether or not a skill
   was used: the 2026-09-02 method would now return 286 Codex rollouts instead
   of 24. A read is counted here only when the path appears in a **tool call or
   its output**.
3. **The August table is no longer reproducible.** See the next section.

## What this is and is not

Unchanged from the previous report: this is field evidence about **delivery**,
not efficacy. Nothing here says what the model would have found without the
skill. The only user in this data is the person who wrote the suite, who knows
the skills exist and phrases requests that route to them. Read every delivery
number with that in mind.

## The August table does not reproduce

Running the committed script today over the same 2026-08-04..2026-08-30 window
gives **90 rows where the report recorded 89**, and the per-skill counts move in
both directions:

| skill | published 2026-09-02 | same script, 2026-10-03 |
|---|---|---|
| product-acceptance | 26 | 30 |
| engineering-assessment | 22 | 22 |
| ai-prose-slop | 12 | 10 |
| code-smells | 8 | 8 |
| mental-models | 8 | 8 |
| frontend | 6 | 4 |
| product-build | 4 | 4 |
| release-engineering | 2 | 3 |
| product-management | 1 | 1 |

The increases are explained: resuming an August session after 2026-09-02 wrote a
new transcript carrying the old turns and their original timestamps. The
decreases are not — sessions that were in the store on 2026-09-02 are no longer
there, and this report does not establish why. **The session store is mutable,
so a count taken from it is a measurement of one moment, not a fact about
August.** Any figure quoted from it needs the date it was extracted, which is
why the script now takes `--from`/`--to` and prints how many duplicates it
removed.

## Claude Code

Source: every `.jsonl` under `~/.claude/projects`, excluding this repository's
own sessions and the eval harness's temporary workspaces.

| | all | August | September | 1–3 October |
|---|---|---|---|---|
| invocations (de-duplicated) | **127** | 83 | 37 | 7 |
| rows before de-duplication | 140 | 90 | 43 | 7 |
| projects | 17 | 15 | 10 | 6 |
| human typed the skill's name | 30 | 29 | 1 | 0 |
| model chose it | 97 | 54 | 36 | 7 |

### The trigger rule was undercounting human-typed by five

Four August prompts name the skill wrapped in backticks or quotes
(`` `agent-skills:product-acceptance` ``, `skill "agent-skills:product-acceptance"`)
and one passes it as a slash-command argument. All five are explicit
instructions to invoke the skill, and all five read as model-chosen under the
old rule, whose leading `\s` could not match a backtick. The same rule's
trailing `\b` matched the skill `frontend` inside a prompt naming
`frontend-design`. Both boundaries are character classes now, and the five
prompts are counted as typed. The published August figure of 27 human-typed was
two short; its 62 model-chosen was eight too many — three duplicates and five
misclassifications.

### Prompts that named no activity

Of the 97 the model chose, **33 followed a prompt that named neither the skill
nor the activity**: "carry on with step 5", "do slice 5", "Try again", "do 418",
"okay lets do it then", "yeah go ahead", "yes merge both and start on A",
"merge it and delete the branch", a bug report about a missing drop-shadow. By
month: 16 August, 13 September, 4 October.

This is a hand judgement over the full prompt text, as it was last time, and it
does not reproduce the previous report's 21-of-62 either. One of that report's
three quoted examples — "we can tag the release, but are you certain we did
everything we set out to?" — continues, in the untruncated prompt, "did we do a
final acceptance review of design.eventwall.app?", which names the activity
outright. The 21 was counted against truncated prompts; a prompt should be
judged whole or not at all.

### The acceptance gate's record

| verdict | runs |
|---|---|
| BLOCK | 9 |
| CONDITIONAL | 5 |
| SHIP | 4 |
| no verdict found | 8 |

All 26 are in August. **product-acceptance was not invoked once in September or
the first three days of October** in any Claude Code session. The previous
report's BLOCK 11 / CONDITIONAL 5 / SHIP 2 differs partly by de-duplication and
partly by the store having changed; nothing here explains the gate going quiet.

### What the skills get used for has shifted

| skill | August | September | October |
|---|---|---|---|
| engineering-assessment | 21 | 17 | 4 |
| product-acceptance | 26 | 0 | 0 |
| product-build | 4 | 11 | 0 |
| ai-prose-slop | 10 | 5 | 0 |
| mental-models | 7 | 0 | 3 |
| code-smells | 7 | 0 | 0 |
| frontend | 4 | 0 | 0 |
| release-engineering | 3 | 0 | 0 |
| testing-strategy | 0 | 2 | 0 |
| code-organization | 0 | 1 | 0 |
| cli-tooling | 0 | 1 | 0 |
| product-management | 1 | 0 | 0 |

Five of the seventeen skills appear nowhere in the window:
backend-engineering, data-modeling, learn-from-session, multi-agent-design,
systems-architecture.

### Subagents and single-prompt sessions

Five invocations happened inside a Task-tool subagent (`isSidechain`), on
2026-08-18, 08-19 and 08-20: product-acceptance four times, release-engineering
once. Those subagents were spawned from interactive sessions, so a human was
upstream of them.

Three invocations are in sessions that only ever received **one** human turn —
the shape a `claude -p` run has. All three prompts asked for the work in so many
words ("independent release-readiness reviewer", "independent product acceptance
pass", "Independent engineering assessment of the whole … codebase"), and two of
the three named the skill. **No Claude Code session with a single prompt
invoked a skill its prompt had not asked for.**

## Codex

Source: 988 `.jsonl` rollouts under `~/.codex/sessions`. 286 mention a suite
`SKILL.md` anywhere; Codex's own `### Available skills` catalogue accounts for
most of them. Restricting to a path inside a tool call or its output gives 94
rollouts: 16 eval-harness runs, 13 with the suite repo as cwd, and 65 organic
candidates, 64 of which show a genuine read (the 65th is a `grep` listing).

Twelve of the 64 are fixtures or probes rather than work — eight
`xtctx-handoff-trial*` workspaces replaying one synthetic prompt, a
harness-dispatch smoke task, an eval calibration workspace, an eval prose
workspace, and a session whose entire prompt was "Append the single line
'worktree probe ok' to note.txt". One more is a rollout whose resumed fork is
also in the set, so its reads are counted twice; dropping the parent and keeping
the fork, which is a superset, leaves **51 organic reads, 46 of them in the
window**:

| | window | August | September | 1–3 October | before the window |
|---|---|---|---|---|---|
| reads | 46 | 6 | 34 | 6 | 5 (Feb–May) |
| projects | 12 | 4 | 5 | 4 | 3 |
| single-prompt runs | 35 | 1 | 28 | 6 | 1 |
| prompt named the skill | 3 | 3 | 0 | 0 | 2 |

Codex has gone from a handful of sessions to the busiest arm after Claude Code,
and the shape of it is new: **35 of the window's 46 reads are single-prompt
runs, and not one of those 35 named the skill it read.** They read
engineering-assessment 28 times and product-acceptance 10. These are read-only
audits and bounded fixes dispatched programmatically, several explicitly marked
"Non-interactive run: nobody can answer questions."

Two qualifications. Codex advertises the catalogue described above, so a skill
is named in the system prompt of every one of these runs — a stronger delivery
mechanism than the one the August `claude -p` probe tested, and the two settings
are not comparable. And the dispatching prompts were written by a model in
another session rather than typed by a person, so "unprompted" here means the
dispatcher did not name the skill, not that no instruction mentioned skills.

Codex still has no first-class skill tool and no verdict to extract, so trigger
and outcome are not recorded beyond the above.

## Antigravity

Source: 168 SQLite conversation stores under
`~/.gemini/antigravity/conversations`, searched with `strings`. Six mention a
suite `SKILL.md`, up from four. One is the suite's own repository. One carries
only the availability catalogue. The remaining four, by month of last write:

| last written | skills | note |
|---|---|---|
| 2026-08-07 | engineering-assessment, multi-agent-design | in the previous report |
| 2026-08-21 | engineering-assessment, multi-agent-design | in the previous report |
| 2026-09-06 | engineering-assessment | a `Viewing engineering-assessment SKILL.md` action |
| 2026-09-22 | ai-prose-slop | a `Viewing ai-prose-slop SKILL.md` action |

So: two in August, both of which reproduce the previous report exactly, and two
new ones in September. These are file write times, not conversation times, and
Antigravity's store does not expose a per-turn timestamp to `strings`.

## Cursor

Source: 97 chat stores under `~/.cursor/chats` and 181 workspace stores under
Cursor's `workspaceStorage`. Thirty-one chats now carry the suite in Cursor's
`<agent_skill fullPath=…>` catalogue — it is installed and advertised there,
which it was not in August.

Actual use: **one skill, on 2026-09-04, in three chats of one workspace**, all
of which read `code-organization/SKILL.md` through a file-read tool call. The
three are one task: the first chat holds a human `<user_query>`, and the other
two open with "You are running as a subagent under a parent agent." So Cursor's
only recorded use of the suite is a human request whose two subagents each read
the same skill. Every other match is the catalogue, plus one mention of the path
in a source comment. The previous report's **zero** is now this.

## Delivery, by harness, over the window

| harness | organic invocations / reads in the window |
|---|---|
| Claude Code | 127 |
| Codex | 46 |
| Antigravity | 2 |
| Cursor | 1 skill, 1 task, 3 chats |

## What changes

- **Delivery is no longer concentrated in one harness.** The previous report's
  "whatever the suite's value is, it is being realised in one harness" is out of
  date: Codex accounts for 46 of the window's 178 reads.
- **The non-interactive claim needs splitting by harness.** It holds for Claude
  Code, where no single-prompt session invoked an unasked-for skill. It does not
  hold for Codex, where 35 single-prompt runs read a skill their prompt never
  named — in a harness that advertises the catalogue, which the `claude -p`
  probe's harness did not.
- **Subagents do invoke skills.** Five times in Claude Code, and in the one
  Cursor task on record it was the subagents that read the skill, not the parent.
- **The acceptance gate has gone quiet.** Twenty-six invocations in August, none
  since.
- **Efficacy is still unmeasured.** `scripts/eval-report.mjs` on 2026-10-03:
  808 runs, 708 eligible, and `completedCaseCount` is 0 for all seventeen
  skills. Every measured skill's arm is marked superseded, because the skill
  texts moved on 2026-09-20 after their runs were recorded.

## Reproducing

```bash
node scripts/skill-outcomes.mjs --from 2026-08-04 --to 2026-10-03
node scripts/skill-outcomes.mjs --from 2026-08-04 --to 2026-10-03 --json
```

The script windows and de-duplicates as of 2026-10-03; a report produced before
that date did neither, so its totals are not comparable to these without
re-running it.

The other three harnesses were searched by hand. For Codex and Antigravity the
search is a path match restricted to tool calls and their outputs, for the
reason given in the opening; the eval marker "Do not search for or inspect
evaluation cases" still excludes harness runs, and a cwd inside this repository
excludes work on the suite itself. Home directory paths in every extract are
redacted with `scripts/lib/redact-home.mjs`. Project names are given only where
the previous report already named them publicly.
