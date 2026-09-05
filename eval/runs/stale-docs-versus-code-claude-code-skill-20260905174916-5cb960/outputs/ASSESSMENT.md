# API Documentation Assessment

## Scope

**In scope**: 
- API documentation (`docs/api.md`)
- API implementation (`src/api.js`)
- Rate limiting implementation (`src/limit.js`)
- Test coverage (`test/limit.test.js`)

**Out of scope**: 
- Production deployment configuration
- Partner integration validation
- Load testing or performance analysis
- Database/persistence layer implementation (stub in place)

**Depth**: Targeted — all in-scope files read in full; all declared API endpoints examined for documentation accuracy.

---

## Environment

**Language/Runtime**: JavaScript (Node.js ESM)

**Frameworks**: Express.js (implied by API pattern, used via dependency)

**Domain**: Public API for partner event ingestion

**Build/Test tooling**: Node.js built-in test runner (`node --test`)

**Project context**: Partners are provided with `docs/api.md` as the API contract; README explicitly states this file "must be kept accurate."

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | **PASS** — 1 test passed (rate limit middleware under max requests) |
| File review | Completed for all 3 source files and 1 test file |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Correctness | API version mismatch: documentation specifies v1, implementation uses v2 | `docs/api.md:8` — `/v1/events`, `/v1/events` (POST)<br/>`src/api.js:11,17` — `/v2/events`, `/v2/events` (POST) | Update `docs/api.md` to reflect v2 endpoints, or revert implementation to v1 |
| 2 | **Critical** | Correctness | Page size mismatch: documentation claims 50 items per page, implementation returns 25 | `docs/api.md:10` — "50 per page"<br/>`src/api.js:3` — `PAGE_SIZE = 25` | Align documentation or implementation; decide on 25 or 50 |
| 3 | **Critical** | Correctness | Pagination mechanism mismatch: documentation specifies offset-based (`?page=2`), implementation uses cursor-based (`?after=<id>`) | `docs/api.md:10` — "Use `?page=2` for the second page"<br/>`src/api.js:11-14` — uses `req.query.after` and returns `nextCursor` | Update documentation to explain cursor-based pagination with `?after=<id>` parameter |
| 4 | **Critical** | Correctness | POST response code mismatch: documentation specifies 201, implementation returns 202 | `docs/api.md:14` — "returns `201`"<br/>`src/api.js:19` — `res.status(202)` | Align response code; 201 (Created) is conventional for POST, 202 (Accepted) if async processing intended |
| 5 | **Critical** | Correctness | POST endpoint undocumented requirement: implementation requires `idempotency-key` header, documentation silent | `src/api.js:18` — checks `req.get('idempotency-key')`, returns 400 if missing<br/>`docs/api.md:12-14` — no mention of this requirement | Document the `idempotency-key` header requirement in `docs/api.md` |
| 6 | **High** | Correctness | Rate limit count mismatch: documentation specifies 100 requests/minute, implementation allows 600/minute | `docs/api.md:18` — "100 requests per minute"<br/>`src/api.js:8` — `max: 600` with `windowMs: 60_000` (60,000ms = 1 minute) | Update documentation to reflect 600 requests/minute or reduce implementation limit to 100 |
| 7 | **High** | Correctness | Rate limit key mismatch: documentation specifies per-token limits, implementation uses per-IP limits | `docs/api.md:18` — "100 requests per minute per token"<br/>`src/limit.js:4` — `const key = req.ip` | Document actual rate-limiting behavior (per IP, not per token), or implement token-based tracking |
| 8 | **High** | Correctness | Authentication gap: documentation requires bearer token and 401 response, implementation lacks authentication check | `docs/api.md:5-6` — "Every endpoint requires a bearer token in the `Authorization` header. Requests without one receive `401`."<br/>`src/api.js:5-22` — no authorization middleware | Implement authentication middleware to validate bearer tokens and return 401 for missing/invalid tokens, or remove authentication requirement from docs |

---

## Unconfirmed Issues

**Database connectivity**: `loadEvents()` in `src/api.js:25-26` is a stub returning an empty array. The documentation does not specify what events are returned or error handling. Unable to verify whether this is intended as a placeholder or indicates incomplete implementation without access to database schema or upstream integration.

---

## Summary

### Strengths

- **Clear project intent**: README correctly identifies `docs/api.md` as the source of truth for partners.
- **Test coverage exists**: Basic rate-limiting test demonstrates the middleware works as implemented (though not as documented).

### Key Risks

This repository has a **critical documentation-to-implementation mismatch** affecting all four documented API features:

- **8 confirmed findings**: All 8 findings are at Critical or High severity because they directly contradict the documented API contract that partners rely on.
- **Endpoint version**: v1 vs. v2 will cause all partner requests to fail (404 Not Found).
- **Pagination logic**: Partners attempting offset-based pagination with `?page=2` will receive unexpected behavior (cursor mode requires `?after=<id>`).
- **Response codes**: Partners expecting 201 will receive 202.
- **Undocumented requirement**: POST requests without `idempotency-key` will be rejected with 400, surprising partners who followed the documentation.
- **Rate limits**: Partners exceeding 100 requests/minute per their documentation may be surprised when limits hit at 600/minute (or vice versa if they over-provision).
- **Authentication**: No bearer token validation is enforced, contradicting the documented requirement.

### Priority Order

1. **Fix endpoint versions** (Finding #1): Highest impact — without this, all partner integrations fail at the routing layer.
2. **Document pagination mechanism** (Finding #3): High impact — offset to cursor is a fundamental API change.
3. **Fix page size** (Finding #2): Update to match 25-item implementation or change implementation to 50.
4. **Fix POST response code** (Finding #4): Partner code expecting 201 may not handle 202 correctly.
5. **Document idempotency-key requirement** (Finding #5): Required to prevent partner POST failures.
6. **Reconcile rate limits** (Findings #6, #7): Clarify whether 100 or 600 requests/minute, and whether per-IP or per-token.
7. **Implement authentication** (Finding #8): Either add bearer token validation middleware or remove from documentation.

### Coverage Gaps

- **No authentication implementation**: Unable to verify that bearer token validation works as documented.
- **No database verification**: `loadEvents()` is a stub; cannot verify actual event payload structure, filtering, sorting.
- **No lint/type checks**: No TypeScript, ESLint, or static analysis run to identify other issues.
- **No integration tests**: Only unit test present (rate limiting); no end-to-end tests verifying actual endpoint behavior against documentation.
- **No production config**: Deployment, environment variables, or runtime behavior not examined.

---

## What Was Verified

✓ **File-by-file comparison of documented endpoints vs. implementation code** — all endpoint paths, methods, parameters, response codes, and middleware behavior examined.

✓ **Rate limiting configuration** — windowMs and max values compared against documentation claim.

✓ **Authentication requirements** — implementation checked for bearer token validation; none found.

✓ **Test execution** — project tests run and confirmed passing.

✓ **API contract stated in project README** — confirmed that docs/api.md is the authoritative partner-facing specification.
