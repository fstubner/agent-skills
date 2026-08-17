# Field telemetry: the skills do get invoked in real work

> **Not v2 evidence.** This is a passive log of `Skill` tool calls from the
> `PostToolUse` hook, not a controlled run. It has no control arm, no
> grader, and — the limitation that matters most — **no record of who
> initiated the call.** The hook fires identically whether the human typed
> the skill's name or the model chose it. Read this as a usage observation,
> never as an answer to the invocation question.

## What the log says

Window: 2026-08-04 to 2026-08-16, twelve days of ordinary work on this
machine. 24 skill invocations, 10 distinct sessions, 8 projects — none of
them this repository, none of them an eval harness.

| Skill | Calls |
|---|---|
| `agent-skills:engineering-assessment` | 7 |
| `agent-skills:ai-prose-slop` | 4 |
| `agent-skills:product-acceptance` | 4 |
| `agent-skills:frontend` | 3 |
| `agent-skills:release-engineering` | 1 |
| other plugins (`cloudflare`, `durable-objects`, `claude-api`, `design:design-system`) | 5 |

Nineteen of the twenty-four are this suite. Zero are `superpowers`, which
is installed throughout.

## Why this matters, carefully

The recorded invocation result to date is **zero** — five unprimed runs,
two harnesses, a description A/B, and a full build with the routing table
injected all produced no invocation. That result stands: it was measured
under controlled conditions with the initiator known to be the model.

This log is not a contradiction of it, because the two do not measure the
same thing. What it does establish is narrower and still worth having: over
twelve days of real work these skills were reached for nineteen times, in
projects with no connection to their development, while a competing plugin
with far more aggressive invocation language was reached for zero times.
Whether a human typed the name each time is unknown and knowable — the hook
could record it.

## Two things it changes

**`engineering-assessment` is the most-used skill in the suite and was the
least documented.** It appeared in no README table until today and is
marked "no evidence" in `docs/SKILL-EVIDENCE.md`. Whatever the mechanism,
it is the one people reach for; it should be first in line for a v2 case,
not last.

**The cut list was wrong about `release-engineering`.** It was on the
"untested, consider cutting" list yesterday. It has since been used in real
work, and it now carries the only checker written in response to a defect
this suite found in its own output.

## The obvious next step

Record the initiator. A `Skill` invocation that followed a user message
containing the skill's name is a different event from one the model chose
unprompted, and the hook already sees enough context to distinguish them.
Until it does, this file cannot be promoted past "observed usage".
