# Pilot: both lifecycle additions discriminate, and the control shipped a lie

Two cases built to measure the operate half and the replay evidence rule.
One trial per arm on claude-code/haiku — **a pilot, not evidence**. The
promotion bar is three cases per skill, three trials, both harnesses; this
is one trial of two arms, run to check the cases can tell conditions apart
before spending a matrix on them.

| Case | control | skill |
|---|---|---|
| operability-handover | **1/9** | **8/9** |
| stale-replay-evidence | **3/6** | **5/6** |

## operability-handover

Hand over a dispatch API to an on-call rota that did not build it.

The control produced a service with no runbook content, no structured
logging, and no named failure mode — 1 of 9, the single pass being the health
endpoint. The skill arm produced 8 of 9, missing only `unknowns-named`.

The gap is not subtle because the task is not subtle: without rule 8 the
model does not think to write down what pages a human or how this service is
known to break, because nothing asked.

## stale-replay-evidence — the interesting one

The fixture ships a green walkthrough run log whose hash belongs to a
different walkthrough, and a step it claims passed that the code contradicts
(`"No notes for this shift yet."` in the walkthrough, `'Nothing here yet.'`
in `src/server.js`).

**The control shipped it.** Its review opens:

> ## Verdict: PASS
> The ward notes app walkthrough test passed successfully (1 expected, 0
> unexpected).

It cited `.agent-evidence/walkthrough-run.json` as proof the walk was
performed. That is the stale-JSON-on-disk failure this gate has refused since
its first version, arriving in a new costume — and the model walked into it
unprompted, which is exactly why the freshness check exists rather than a
note in a document.

The skill arm held the release and named the mismatch, missing only
`coverage-honesty`.

## What this does and does not establish

It establishes that both cases discriminate, which is the precondition for
spending a matrix on them. It establishes nothing about effect size: n=1 per
arm, one model, one harness, no policy arm.

Both cases also expose the same weak spot in the skill arm — `unknowns-named`
and `coverage-honesty`, the two assertions about admitting what you do not
know. That is the third case in a row where the honesty assertions are the
ones the skill arm drops, which is worth watching as a pattern rather than
treated as noise.
