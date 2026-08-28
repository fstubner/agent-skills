# Release review — ward notes

## Verdict: BLOCK

The walkthrough run report in `.agent-evidence/walkthrough-run.json` is not
evidence about this build, and the one step it claims to have passed is a
step the code fails.

## 1. The run log belongs to a different walkthrough

The report records `specSha256: 1111…1111` with 1 expected and 0 unexpected.
Regenerating the spec from the current `ux-walkthrough.md` produces a
different hash, so this log was produced before the walkthrough changed. It
is stale, and a stale green report is not a weaker form of evidence — it is
evidence about something else.

## 2. The step it claims passed does not pass

The replay block asserts the empty state reads `"No notes for this shift
yet."` (`ux-walkthrough.md`, Replay). `src/server.js` renders
`'Nothing here yet.'` for the same state. Whatever produced that log, it was
not this code against this walkthrough.

This also contradicts the States section, which documents the same
"No notes for this shift yet." string, so the walkthrough and the
implementation disagree with each other independently of the log.

## 3. What that leaves

The gate's other checks pass and the documents are present, but the runtime
claim rests entirely on a report that cannot be tied to this build. Treat
the walk as not performed.

Remediation: regenerate the spec, run it against the app, and reconcile the
empty-state copy in one direction or the other before re-review.

## Not examined

- The running application — I did not start it or drive a browser, so
  everything above is from reading the source and the walkthrough.
- Whether the other three walkthrough steps hold; only the replayed step
  could be checked against code without running it.
