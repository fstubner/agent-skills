# Engineering assessment — events API

## Scope

**In scope:** `src/api.js`, `src/limit.js`, `docs/api.md`,
`test/limit.test.js`, `package.json`, `README.md`.

**Depth:** targeted. `docs/api.md` is in scope as a subject, not as
background: the README says it is what partners are given, so a claim in it is
a claim the product makes.

## What I ran

```
$ npm test
✔ requests under the limit pass through (0.8ms)
ℹ pass 1  ℹ fail 0
```

One test, over the rate limiter's pass-through path. Nothing exercises the
429 branch, the routes, or anything in `docs/api.md`.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | There is no authentication on either endpoint, and the published docs say there is | `docs/api.md:5-7` states every endpoint requires a bearer token and returns 401 without one; `src/api.js` has no auth middleware and neither route checks a header | Add authentication before anything else here. Until then both endpoints are open |
| 2 | High | Documentation | The documented paths do not exist | `docs/api.md` documents `/v1/events`; `src/api.js:11,18` serve `/v2/events` | Publish the paths that exist |
| 3 | High | Documentation | Pagination is documented as page numbers, implemented as cursors, with a different page size | `docs/api.md` says 50 per page with `?page=2`; `src/api.js:10,13-15` uses `PAGE_SIZE = 25` and `?after=<id>` returning `nextCursor` | Rewrite the pagination section against the implementation |
| 4 | High | Documentation | POST requires an `idempotency-key` header that is documented nowhere, and rejects without it | `src/api.js:19` returns 400 when the header is absent; `docs/api.md` never mentions it | Document it. A required header absent from the docs is a guaranteed integration failure |
| 5 | Medium | Documentation | The POST response is documented as 201 with the created body; it returns 202 with `{accepted:true}` | `docs/api.md` against `src/api.js:20` | Correct the docs, or change the response if 201 was the intent |
| 6 | Medium | Reliability | Rate limits differ from the documented ones in both number and subject | `docs/api.md` says 100 per minute per token; `src/api.js:8` configures 600 per minute and `src/limit.js:4` keys on `req.ip`, not a token | Reconcile. Per-IP limiting also groups every partner behind one NAT into a shared budget |

**Findings 2 to 6 are drift; finding 1 is not.** A partner reading these docs
would conclude the API is authenticated, and would be wrong. That is why it is
rated on the security scale rather than the documentation one, and why it does
not belong in a list of things to tidy up.

**The rate limiter also does not do what its own configuration suggests.**
`src/limit.js:8` filters the window and pushes before comparing, so the
threshold is effectively `max + 1` — a minor arithmetic point next to the
above, but it means neither the documented number nor the configured one is
the number enforced.

## Unconfirmed / requires investigation

- **Whether authentication is terminated in front of this service.** A gateway
  or service mesh could be checking the bearer token before the request
  arrives, which would make finding 1 a documentation issue rather than an
  open API. Nothing in this repository indicates one, and the docs describe
  the behaviour as this service's. This is the single question to answer
  first, because the severity of finding 1 depends entirely on it.
- **Whether `/v1/` is served elsewhere.** If an older deployment still serves
  it, the docs may be accurate about a system that exists somewhere other than
  this repository.

## Strengths

- **The cursor pagination is the better design**, and it returns an explicit
  `nextCursor` rather than making the caller construct one. The defect is that
  nobody told the partners.
- **The idempotency requirement on POST is right for an ingestion endpoint**,
  and it fails closed with a clear message rather than accepting a duplicate.

## What I did not examine

- **Any gateway, proxy or mesh configuration**, which is what finding 1's
  severity turns on and is not in this repository.
- **`loadEvents`**, which returns an empty array — it is a stub, so I could
  not assess the query behind the pagination.
- **Whether partners are on `/v1/` today.** No client code, no access logs.
