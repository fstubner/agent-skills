# API Documentation Assessment

## Scope

**In scope:**
- API documentation (`docs/api.md`)
- API implementation (`src/api.js`)
- Rate limiting implementation (`src/limit.js`)
- Test coverage (`test/limit.test.js`)
- Package configuration (`package.json`)

**Out of scope:**
- Production deployment or runtime behavior
- Partner integration tests or actual API calls
- Database or data layer implementation
- Client libraries or SDKs

**Depth:** Targeted — all in-scope files read in full.

## Environment

- **Language/Runtime:** JavaScript/Node.js (ES modules)
- **Type:** Express.js API application
- **Domain:** Events API for partner event ingestion
- **Build/Test System:** npm with `node --test`

## Tooling Results

**Tools run:**
- `npm test`: Requires approval for execution; test file examined manually.

**Tools not run:**
- `npm test`: Approval required; test file shows basic rate limit tests but cannot be executed in this assessment context.

**Tools unavailable:**
- No build step defined in package.json (main is entry point only).
- No linter, type checker, or audit tools configured.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | API version mismatch: docs describe v1, implementation provides v2 | `docs/api.md` lines 8,12 reference `/v1/events`; `src/api.js` lines 11,17 implement `/v2/events` | Update docs to reflect actual endpoints (`/v2/events` for GET and POST) or revert code to `/v1/events`. |
| 2 | Critical | Correctness | Pagination method undocumented: code uses cursor-based pagination, docs claim offset/page-based | `docs/api.md` line 10 states "Use `?page=2` for the second page"; `src/api.js` line 12 uses `?after=<id>` cursor pagination | Update docs to document cursor pagination: "Use `?after=<id>` to fetch events after the given event ID." |
| 3 | Critical | Correctness | Response status code mismatch on POST: docs claim 201, code returns 202 | `docs/api.md` line 14 states "returns `201` with the created event body"; `src/api.js` line 19 returns `res.status(202)` | Update docs to: "returns `202` (Accepted) with `{accepted: true}` body" or change code to return 201. |
| 4 | Critical | Correctness | Missing required header undocumented: POST /v2/events requires `idempotency-key` header | `src/api.js` line 18 checks `if (!req.get('idempotency-key'))` and returns 400; `docs/api.md` makes no mention of this requirement | Add to POST /v2/events docs: "Requires `idempotency-key` header; returns 400 without it." |
| 5 | High | Correctness | Rate limit value mismatch: docs claim 100 requests/min, code enforces 600 requests/min | `docs/api.md` line 18 states "100 requests per minute"; `src/api.js` line 8 sets `max: 600` with `windowMs: 60_000` (600 per 60 seconds) | Update docs to "600 requests per minute per IP" or change code to `max: 100`. |
| 6 | High | Correctness | Rate limiting scope undocumented: docs claim per-token, code limits per IP | `docs/api.md` line 18 states "per token"; `src/limit.js` line 4 uses `const key = req.ip` for rate limiting | Update docs to: "600 requests per minute per IP address" and note that rate limiting is not token-based. |
| 7 | High | Security | Authentication not implemented: docs require bearer token, code does not check Authorization header | `docs/api.md` lines 3-6 describe authentication requirement and 401 response; `src/api.js` has no auth middleware or Authorization header check | Implement authentication middleware to validate bearer tokens, or remove authentication section from docs if not required. |
| 8 | High | Correctness | POST response body mismatch: docs claim created event is returned, code returns `{accepted: true}` | `docs/api.md` line 14 states "returns `201` with the created event body"; `src/api.js` line 19 returns `res.status(202).json({ accepted: true })` | Update docs to match response format: "Accepts an event and returns 202 with `{accepted: true}`" or change code to return the created event. |

## Unconfirmed Issues

None identified. All discrepancies are confirmed by direct code inspection.

## Summary

### Strengths

- Cursor-based pagination in the implementation is a sound approach for event APIs (better than offset-based for large datasets).
- Rate limiting is implemented and functional for protecting the API.

### Key Risks

The API documentation and implementation are fundamentally misaligned across **8 critical and high-severity areas:**

1. **Version mismatch** (Finding #1): Partners are instructed to call `/v1/events`, but the server only responds to `/v2/events`.
2. **Authentication gap** (Finding #7): Docs promise auth protection; code provides none.
3. **Pagination mismatch** (Finding #2): Partners trained on page-based pagination will fail with cursor parameters.
4. **Rate limit confusion** (Findings #5, #6): Partners are told to expect 100/min token-based limits; they actually face 600/min IP-based limits.
5. **Response contract violations** (Findings #3, #4, #8): Status codes, required headers, and response bodies all differ from documentation.

**Impact:** Partners integrating against the documented API will experience authentication failures, connection errors, and unexpected response formats.

### Priority Order

1. **[CRITICAL] Align API version** — Update docs to `/v2/events` or revert code to `/v1/events`. (Blocks all partner integration.)
2. **[CRITICAL] Document pagination method** — Update docs to reflect cursor-based pagination with `?after=<id>`.
3. **[CRITICAL] Document POST requirements and response** — Add `idempotency-key` requirement, correct status code (202), and response body (`{accepted: true}`).
4. **[HIGH] Fix rate limit documentation** — Update to 600 requests/min per IP; remove token-based rate limiting claim or implement it.
5. **[HIGH] Implement or remove authentication** — Either implement bearer token validation in code or remove auth documentation.

### Coverage Gaps

- **Production behavior:** Assessment is based on code only; actual runtime behavior with express and Node.js runtime not tested.
- **Database/persistence:** `loadEvents()` returns empty array; actual data layer not reviewed.
- **Error handling:** No review of error responses beyond 400, 429, 401 documented cases.
- **HTTP status code completeness:** Docs may be missing status codes for other error scenarios.
- **Performance testing:** No load testing to verify rate limiter behavior under concurrent requests.
- **Partner feedback:** No audit of actual partner error logs or integration attempts.
- **Automated tests:** Could not execute `npm test` in this context; test coverage for auth, pagination, and POST idempotency requirements not verified beyond the single test file present.

## What I Verified

I verified all 8 findings by direct inspection of the source code:
- Compared documented endpoint paths (`/v1/events` vs `/v2/events`)
- Compared documented pagination method (page-based vs actual cursor-based)
- Compared documented POST response (201 with event body vs 202 with `{accepted: true}`)
- Confirmed missing idempotency-key header requirement in docs
- Confirmed rate limit value discrepancy (100 vs 600 per minute)
- Confirmed rate limiting scope mismatch (per-token vs per-IP)
- Confirmed absent authentication implementation vs documented requirement
- Confirmed response body format mismatch
