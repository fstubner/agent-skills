# API Documentation Assessment

## Scope

**In scope:**
- `src/api.js` — endpoint definitions and implementation
- `src/limit.js` — rate limiting middleware
- `docs/api.md` — API documentation provided to partners
- `package.json` — project configuration and test setup
- `test/limit.test.js` — rate limit unit tests

**Out of scope:**
- `.agent-input/` — skill documentation and references (not part of the API project)

**Depth:** Targeted — all in-scope files read in full; test suite executed.

---

## Environment

**Language/Runtime:** JavaScript (Node.js ES modules)

**Frameworks:** Express.js (imported but not version-locked in package.json)

**Domain:** REST API for event ingestion with authentication and rate limiting

**Build System:** Node.js with npm scripts; test via `node --test`

**Key Files:**
- Main entry: `src/api.js` (exports `createApp` function)
- Middleware: `src/limit.js` (rate limiting middleware)
- Documentation: `docs/api.md`

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | ✔ All tests pass (1 suite, 1 pass, 0 fail) — rate limit middleware correctly blocks requests over the `max` threshold. |

No build step configured in `package.json`. No linting, type checking, or audit tools configured.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Reliability | API version mismatch between documentation and implementation | `docs/api.md` line 8, 12: documents `/v1/events` GET and POST endpoints. `src/api.js` lines 11, 17: implementation exposes `/v2/events` GET and POST endpoints only. Partners receive 404 on documented paths. | Update documentation to reflect `/v2/events` endpoint paths, or update implementation to provide `/v1/events` as documented. |
| 2 | High | Reliability | Pagination method differs from documentation | `docs/api.md` line 10: states "Use `?page=2` for the second page" (offset pagination). `src/api.js` lines 11-14: uses cursor-based pagination with `?after=<id>` parameter. Partners' page-based requests will fail or return unexpected data. | Update documentation to describe cursor-based pagination with `?after=<id>`, or update implementation to match offset-based pagination in docs. |
| 3 | High | Reliability | Page size undocumented; contradicts documentation | `docs/api.md` line 10: states "50 per page." `src/api.js` line 3: `PAGE_SIZE = 25`. Partners expecting 50 items per page receive 25. | Update documentation to state 25 items per page, or change `PAGE_SIZE` to 50. |
| 4 | High | Reliability | POST endpoint response format and status code mismatch | `docs/api.md` line 14: states POST "returns `201` with the created event body." `src/api.js` lines 17-20: returns HTTP `202` with `{ accepted: true }`, not the created event. Partners cannot rely on documented response shape. | Update documentation to specify `202` response and `{ accepted: true }` body, or update implementation to return `201` with event data. |
| 5 | High | Reliability | POST requires undocumented header | `src/api.js` line 18: POST endpoint requires `idempotency-key` header; returns `400` if missing. `docs/api.md`: no mention of this required header. Partners' requests without this header will fail. | Document the `idempotency-key` header requirement in POST endpoint documentation. |
| 6 | Medium | Reliability | Rate limit applied per IP, not per token as documented | `docs/api.md` line 18: states "100 requests per minute per token." `src/limit.js` lines 2-11: rate limiting middleware uses `req.ip` as the key, not bearer token. Rate limits are enforced per client IP, not per authentication token. | Update documentation to clarify rate limits are per client IP, or modify middleware to extract and use the bearer token from the Authorization header. |
| 7 | Medium | Reliability | Rate limit request threshold undocumented | `docs/api.md` line 18: states "100 requests per minute." `src/api.js` line 8: rate limiter configured with `max: 600`. This allows 600 requests per 60-second window, not 100. Partners may rely on 100-req/min SLA but system allows 6x higher traffic. | Update documentation to state 600 requests per minute, or reconfigure middleware to `max: 100`. |

---

## Unconfirmed Issues

None identified. All issues above have direct evidence in source and documentation files.

---

## Summary

### Strengths

1. **Test coverage for rate limiting:** The rate limit middleware is tested (`test/limit.test.js`) and the test passes. The test correctly verifies that requests under the limit are allowed through.
2. **Clean middleware implementation:** The `rateLimit` function in `src/limit.js` is concise and implements a sliding-window rate limit correctly using a timestamp-based approach.

### Key Risks

The codebase has **7 confirmed findings**, all **High or Medium severity**, centered on a systemic mismatch between API documentation and implementation. This is a critical issue for partner integration:

- **Partners attempting to use documented endpoints (`/v1/events` with page pagination) will fail** with 404 or unexpected behavior, as the implementation uses `/v2/events` with cursor pagination.
- **POST requests without the undocumented `idempotency-key` header will return 400**, blocking partners from creating events.
- **Response format for POST differs from documentation** — partners cannot parse responses as documented.
- **Rate limits are applied inconsistently** — documentation specifies per-token rate limiting, but implementation applies per-IP limits; threshold is 6× higher than documented.

### Priority Order

1. **Resolve endpoint path mismatch (Finding #1)** — This is the root blocker preventing partners from reaching any endpoint.
   
2. **Correct pagination documentation or implementation (Finding #2)** — Partners must know the correct pagination method; cursor-based is more efficient than offset-based.

3. **Align page size across implementation and docs (Finding #3)** — Document the actual 25-item page size.

4. **Document POST response format and status code (Finding #4)** — Partners must know to expect `202` and `{ accepted: true }`, not `201` with event data.

5. **Document idempotency-key requirement (Finding #5)** — This is a hard requirement for POST success; omitting it from docs guarantees partner request failures.

6. **Clarify rate limit scope (Finding #6)** — Determine whether limits should be per-IP or per-token, document accordingly, and update implementation if needed.

7. **Correct rate limit threshold (Finding #7)** — Align the `max: 600` configuration with documented 100 req/min, or update documentation.

### Coverage Gaps

- **Production deployment and monitoring:** No evidence of how the API is deployed, monitored, or scaled in production.
- **Authentication implementation:** Documentation mentions bearer token authentication, but no auth validation code is visible in `src/api.js`. The rate limiter does not use the token; auth may be handled elsewhere.
- **Database or event storage:** `loadEvents()` at line 25 returns an empty array; actual persistence is not shown.
- **Integration tests:** Only unit tests for the rate limiter exist; no end-to-end tests validating the documented endpoints.
- **Error handling details:** Documentation does not specify error response formats (e.g., does 404 return JSON with an error field?).
- **Dependency versions:** `package.json` specifies Express but not its version; vulnerability status and compatibility are unknown.

---

## What I Verified

- All source files (`api.js`, `limit.js`) are syntactically correct and the test suite passes.
- Documentation file (`docs/api.md`) exists and is readable.
- **Root cause identified:** 7 confirmed mismatches between documented API contract (v1, 50-item pages, 201 POST response, per-token rate limits at 100 req/min) and actual implementation (v2, 25-item pages, 202 POST response requiring `idempotency-key`, per-IP rate limits at 600 req/min).
- Partners complaining about API mismatch are correct — the implementation does not match the documentation provided to them.
