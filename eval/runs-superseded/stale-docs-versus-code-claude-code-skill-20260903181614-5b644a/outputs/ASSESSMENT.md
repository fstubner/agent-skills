# API Documentation Assessment

## Scope

**In scope:**
- API documentation at `docs/api.md`
- API implementation in `src/api.js`
- Rate limiting implementation in `src/limit.js`
- Test suite in `test/limit.test.js`

**Out of scope:**
- Deployment configuration
- Authentication token validation logic
- Actual event storage/database layer (stubbed with empty function)
- Load testing or production metrics
- Partner integration testing

**Depth:** Targeted — all in-scope files read in full; automated checks attempted but deferred due to execution approval requirements.

---

## Environment

**Language and runtime:** JavaScript/Node.js (ES modules)

**Frameworks and libraries:** Express.js (inferred from createApp pattern)

**Domain:** REST API for event ingestion

**API version:** v2 (in implementation, v1 in documentation)

---

## Tooling Results

**Tools run successfully:**
- Manual code inspection completed for all source files

**Tools that failed/required approval:**
- `node --test test/limit.test.js` — execution approval required

**Tools not attempted:**
- Build verification (no build script in package.json)
- Lint/format checking (no linting tools configured)

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | API endpoint version mismatch | `src/api.js:11,17` — endpoints are `/v2/events` but `docs/api.md:8,12` documents `/v1/events` | Update documentation to reflect v2 endpoints or update code to match documented v1 |
| 2 | Critical | Correctness | Page size discrepancy | `src/api.js:3` defines `PAGE_SIZE = 25`, but `docs/api.md:10` states "50 per page" | Update documentation to state 25 per page, or update `PAGE_SIZE` constant to 50 |
| 3 | Critical | Correctness | Pagination method mismatch | `src/api.js:10-14` uses cursor-based pagination with `?after=<id>` parameter returning `nextCursor`, but `docs/api.md:10` documents offset pagination with `?page=2` | Update documentation to describe cursor pagination with `?after` parameter and `nextCursor` response field |
| 4 | Critical | Correctness | POST response status code mismatch | `src/api.js:19` returns `202` status, but `docs/api.md:14` states "returns `201`" | Update documentation to state 202 status or change implementation to return 201 |
| 5 | Critical | Correctness | POST response format mismatch | `src/api.js:19` returns `{ accepted: true }`, but `docs/api.md:14` states it returns "the created event body" | Update documentation to describe the actual response format or implement full event creation with event body response |
| 6 | Critical | Correctness | Rate limit threshold mismatch | `src/api.js:8` configures `max: 600` requests per 60 seconds, but `docs/api.md:18` states "100 requests per minute per token" | Update documentation to state 600 requests per minute or reduce `max` configuration to 100 |
| 7 | High | Security | Rate limiting by IP instead of token | `src/limit.js:4` uses `req.ip` as the rate limit key, but `docs/api.md:18` specifies "per token" rate limiting | Implement authentication token extraction and use token as the rate limit key instead of IP |
| 8 | High | Correctness | Missing required header not documented | `src/api.js:18` requires `idempotency-key` header with 400 error if absent, but `docs/api.md` makes no mention of this requirement | Document the `idempotency-key` header requirement for POST /v2/events endpoint |

---

## Unconfirmed Issues

None identified. All findings are based on direct code inspection and documentation comparison.

---

## Summary

### Strengths

- **Clear separation of concerns:** Rate limiting logic isolated in dedicated module with testable interface (`src/limit.js`).
- **Test coverage:** Includes basic test suite for rate limiting implementation (`test/limit.test.js`), ensuring core middleware behavior.

### Key Risks

The API documentation and implementation are fundamentally misaligned across all documented endpoints:
- **Endpoint versions** (v1 vs v2) differ between docs and code
- **Pagination strategy** documented as offset-based but implemented as cursor-based
- **Response formats** for POST requests do not match documentation
- **Rate limiting** threshold is 6× higher than documented and uses IP-based instead of token-based limiting
- **Required headers** for POST requests are not documented

Partners implementing against the documentation will experience immediate failures due to:
1. Wrong endpoint versions (404 errors on v1 paths)
2. Incorrect pagination parameters (unexpected `?page=2` to actual API)
3. Wrong response parsing (expecting event body, receiving `{ accepted: true }`)
4. Unexpected status codes (expecting 201, receiving 202)
5. Undocumented header requirements (400 errors without `idempotency-key`)

### Priority Order

1. **Update all endpoint versions from v1 to v2** (Findings #1) — Partners currently hit 404s
2. **Document correct page size** (Finding #2) — Partners experience pagination misalignment
3. **Document cursor-based pagination** (Finding #3) — Partners cannot implement pagination correctly
4. **Document actual POST response** (Findings #4, #5) — Partners cannot parse responses
5. **Document idempotency-key requirement** (Finding #8) — POST requests fail with undocumented errors
6. **Update rate limit documentation** (Finding #6) — Partners may implement throttling at wrong threshold
7. **Implement token-based rate limiting** (Finding #7) — Current IP-based limiting allows circumvention

### Coverage Gaps

- **Not examined:** Authentication token validation and enforcement
- **Not examined:** Event validation and storage implementation (endpoint handlers return stub data)
- **Not examined:** Production deployment and actual traffic patterns
- **Not examined:** Historical API versions or deprecation strategy
- **Tools not run:** Automated tests (required approval), linting, type checking (no TypeScript)
- **Not verified:** Whether `/v2` endpoints are intentional new version or accidental API change

---

## What I verified

I compared the documented API specification in `docs/api.md` against the actual implementation in `src/api.js` and `src/limit.js`. The assessment identified 8 specific mismatches across endpoint versions, pagination methods, response formats, status codes, and rate limiting behavior that would cause partners to experience failures when integrating against the documented API.
