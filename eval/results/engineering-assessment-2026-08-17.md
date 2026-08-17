# engineering-assessment: one arm ran, and the harness scored the other two wrong

First attempt at a v2 case for the most-used skill in the suite. It produced
one real data point, no comparison, and one defect in the evaluation system
itself — which is the part worth reading.

## What ran

| Arm | Harness | Result |
|---|---|---|
| control | codex 0.146.0 (Ubuntu container), gpt-5.6-luna | **2 of 5 assertions passed**, 145s, 88,684 tokens, 0.97 credits |
| policy | same | **did not run** — account usage limit, resets 2026-08-20 |
| skill | same | **did not run** — same |

Two harnesses were tried before the container path worked. `claude-code`
could not authenticate from a non-interactive session. Native Windows
`codex` runs read-only, so the agent read the fixture, wrote nothing, and
the harness correctly reported `writing is blocked by read-only sandbox`.
Only `--codex-container` produces deliverables on this machine, which is
worth knowing before anyone plans a run here.

## The control arm's actual output

Unprompted, with no skill in front of it, the model found the planted
default-credential risk and wrote a competent finding about it:

> `authorized()` falls back to the literal token `admin` whenever
> `ADMIN_TOKEN` is unset or empty (`src/server.js:4-6`)

It passed `false-green-detected` (recognised that a passing smoke command
is not coverage) and `tooling-evidence` (recorded the test run separately
from test adequacy). It failed `planted-risks-cited` — the citations did
not validate against all three planted risks — plus
`ranked-actionable-findings` and `coverage-honesty`.

So the control ceiling on this case is 2/5, and the three failures are the
headroom a skill would have to fill. That is a usable baseline. It is also
the only number here.

## The defect this run found

The policy and skill runs hit the account's usage limit. No model turn
happened: exit 1, ~25s, zero tokens, a `turn.failed` event in the
transcript. **The grader recorded five FAILED assertions for each.**

Absence of evidence read as evidence of absence, inside the system built to
prevent exactly that. Had I not checked the token counts, this file would
have reported "engineering-assessment scores 0/5 with the skill loaded" —
a fabricated negative result about the suite's most-used skill.

The environment-failure matcher already existed and already caught
authentication and read-only-sandbox failures; quota exhaustion simply was
not in its list. Two fixes, because one of them is brittle by nature:

1. The matcher now covers usage limits, rate limits, quota exhaustion,
   overload and 503/529-class responses.
2. A structural backstop that does not depend on any provider's wording: a
   non-zero exit with no tokens billed means no model turn ran, whatever
   the message says.

Both are pinned by tests, including two that assert a genuine model result
is *not* misread as an environment failure. The two false-negative bundles
were deleted rather than kept — they are not evidence of anything.

## Status

`engineering-assessment` remains unmeasured. Promotion needs three fresh
cases, three trials per condition, both harnesses; this is one case, one
trial, one arm. The remaining arms can run after 2026-08-20 when the Codex
quota resets, or sooner on an authenticated `claude-code` session.
