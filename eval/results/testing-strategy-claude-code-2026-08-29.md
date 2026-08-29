# testing-strategy: no effect on claude-code either, this time with headroom

The codex cohort had returned an outcome delta of 0.02 and I read it as a hint
that the skill does nothing. That reading was wrong, and so was the correction
I made to it. Both are recorded here because the sequence is the point.

## What the codex number actually meant

`retry-delay-regression-suite` scores **5/5 in all nine codex runs** — control,
policy and skill alike. A control arm at ceiling cannot produce a delta however
good the skill is. On `shipping-fee-regression-suite`, every healthy codex run
lands on exactly 4/5, always missing the same assertion. So 0.02 was not a
measurement of the skill. It was two cases with no room to move.

## Why claude-code was worth running anyway

The ceiling is a property of codex on these cases, not of the cases. On
claude-code/haiku the same `retry-delay` control arm spans **0/5, 3/5, 5/5**.
Full range, plenty of headroom.

The skill still did nothing.

| Case | control | policy | skill | delta vs policy |
|---|---|---|---|---|
| retry-delay | 0.800 | 0.840 | 0.833 | **-0.007** |
| shipping-fee | 0.800 | 0.767 | 0.800 | **+0.033** |

Interim claude-code delta **0.013**, 95% CI **[-0.241, +0.267]**. Two harnesses
reach zero independently, one at the ceiling and one with room. This is a
cleaner negative than `engineering-assessment`'s near-miss.

Single-cohort view. Promotion requires every declared harness, so this is not a
promotion result, and `testing-strategy` cannot reach one regardless: it has two
configured cases against a required three.

## The one place the skill moves

`public-behavior` — the assertion that a private rename must not break the
tests, which is this skill's central rule about testing behavior rather than
implementation.

| Condition | pass rate |
|---|---|
| control | 4/18 (22%) |
| policy | 6/18 (33%) |
| skill | 9/20 (45%) |

The skill roughly doubles the control rate and still fails the majority of the
time. One assertion of five, so it is swamped in the aggregate. It is the only
signal in this dataset, and it sits inside a result I had already written off.

## A failure mode worth recording

`retry-delay` produced a 3/5 where all three mutant-kill assertions passed but
`stable-baseline` failed: tests that catch every planted bug and do not pass
against unmodified source. A suite that fails CI on day one. Per-assertion
grading sees that; a pass/fail score cannot.

## What was spent, corrected

Thirty-two invocations, not the eighteen reported during the session. A batch
stopped mid-run kept going after the stop was reported successful — the log
shows all 18 of its cells completing — and a second batch of 14 then ran on top
of cells that were already filled. That is why several cells carry five or six
trials against a required three.

The conclusion is unaffected: every number above was computed after both
batches, so it rests on the full set. The spend figure quoted during the session
was wrong, and the same runner-outlives-its-stop failure has now happened twice.
