# Engineering assessment — job worker

## Scope

**In scope:** the whole repository — `src/queue.js`, `src/notify.js`,
`src/worker.js`, `test/queue.test.js`, `package.json`, `README.md`.

**Out of scope, and it matters here:** the billing partner's endpoint. It is
named in `src/notify.js` and is not in this repository. Finding 3 below turns
on its behaviour and I cannot see it.

**Depth:** targeted — every file read in full.

## What I ran

```
$ npm test
✔ a job can be enqueued, claimed and completed (43.9ms)
ℹ pass 1  ℹ fail 0
```

One test, single-worker, happy path. It exercises none of the concurrency the
README describes and none of the failure paths below. No lint, type-check or
build command is declared, so none was attempted.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Correctness | Two workers can claim the same job | `src/queue.js:24-27` — `claimNext` reads the whole file, picks the first unclaimed job, mutates and rewrites; there is no lock or compare-and-set. `README.md` states four workers run in production | Claim with an atomic conditional update, or move the queue to something with row-level locking |
| 2 | High | Reliability | A job whose notify throws is stuck forever, and the README says the opposite | `src/worker.js:7` — if `notifyPartner` rejects, `complete` never runs and the job keeps `claimedBy` set. `src/queue.js:23` — `claimNext` only considers jobs where `!j.claimedBy`, so no worker will ever pick it up again. `README.md` claims a restart "picks up work again" | Release the claim on failure, or claim with a lease that expires |

## Unconfirmed / requires investigation

**Duplicate partner notifications on restart.** `src/worker.js:7-9` notifies
the partner and then marks the job done as two separate steps. A crash or
restart between them — which the README says is the normal retry path —
leaves the job claimed but un-completed. Combined with finding 2 the job is
stuck rather than retried, so the double-notify may never fire in practice;
but if finding 2 is fixed by releasing the claim, the same job is notified
twice.

**Whether that causes double billing depends entirely on the partner
endpoint, which is not in this repository.** `src/notify.js:6` posts only
`{ jobId }` with no idempotency key and no request id. If the partner
deduplicates on `jobId` this is harmless; if it does not, fixing finding 2
introduces a billing defect.

I am not rating this. It is not a finding until someone checks, and the
severity swings between Info and Critical depending on the answer.

**What would confirm it:** the partner's API documentation at the URL in
`src/notify.js`, or one test call repeating the same `jobId` against their
sandbox and observing whether a second charge appears. Either settles it in
minutes. Until then the safe sequencing is to fix findings 1 and 2 together
with an idempotency key, rather than fix 2 alone.

## Strengths

- **Writes go through one module.** `src/queue.js` is the only writer of
  `.data/`, so the concurrency fix in finding 1 has exactly one place to land.
- **The failure path is explicit rather than swallowed.**
  `src/notify.js:9` throws on a non-2xx response instead of returning a
  falsy value that the caller would ignore.

## What I did not examine

- **The partner endpoint**, as above. It is the single largest gap in this
  assessment and finding 3 cannot be closed without it.
- **The process manager.** The README's retry story depends on it and no
  configuration for it is in the repository.
- **Behaviour under real concurrency.** Finding 1 is read from the code; I
  did not run four workers against one file to observe a lost claim.
- **Data volume.** `.data/jobs.json` is rewritten whole on every operation,
  which has a size limit somewhere, and nothing here says what the job count
  looks like.
