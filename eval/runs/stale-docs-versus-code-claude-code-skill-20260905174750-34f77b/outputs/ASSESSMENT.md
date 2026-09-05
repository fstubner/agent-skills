# API Documentation Assessment

## Scope

**In scope**: API documentation (docs/api.md) vs. implementation (src/api.js, src/limit.js); endpoints, authentication, rate limiting, response formats.

**Out of scope**: Database layer, event data schema, deployment infrastructure, production metrics, client SDKs, integration tests with external services.

**Depth**: Targeted — all in-scope files read in full; available tests run and their output recorded.

---

## Environment

- **Language & Runtime**: JavaScript (Node.js), ES modules
- **Framework**: Express.js (referenced in api.js, not yet installed)
- **Domain**: Events API for partner integration
- **Build tools**: npm
- **Test runner**: Node.js built-in test module

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | ✅ Passed. Single test "requests under the limit pass through" completed successfully. Duration: 119.07ms |
| `npm run build` | ⚠️ Not configured. No build script in package.json |
| `npm run lint` | ⚠️ Not configured. No lint script in package.json |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | API version in docs does not match implementation | docs/api.md lines 8, 12 reference `/v1/events`; src/api.js lines 11, 17 implement `/v2/events`. Partners following documentation will receive 404 errors. | Update docs/api.md to reference `/v2/events` endpoints, or update implementation to use `/v1/events` to match documented contract. |
| 2 | Critical | Correctness | Pagination implementation mismatch | docs/api.md line 10: "Use `?page=2` for the second page." src/api.js line 12: `const after = req.query.after ?? null;` implements cursor-based pagination with `?after=<id>` parameter. Partners using `?page=2` will receive incorrect results. | Update docs/api.md line 10 to document cursor-based pagination: "Use `?after=<id>` to fetch events after the specified cursor." Include example of how to use `nextCursor` from response. |
| 3 | High | Correctness | GET response page size mismatch | docs/api.md line 10: "50 per page"; src/api.js line 3: `const PAGE_SIZE = 25`. Partners expect 50 events per request but will receive 25. | Update docs/api.md line 10 to state "25 per page" to match implementation. |
| 4 | High | Correctness | POST response status code mismatch | docs/api.md line 14: "returns `201`"; src/api.js line 19: `res.status(202)`. Partners expecting 201 Created will receive 202 Accepted instead. | Update docs/api.md line 14 to state "returns `202`". Document the reason (asynchronous processing) if applicable. |
| 5 | High | Correctness | POST response body format mismatch | docs/api.md line 14: "returns `201` with the created event body"; src/api.js line 19: returns `{ accepted: true }`. Partners expecting the full event object in response cannot use the response directly. | Update docs/api.md line 14 to specify response format: "returns `202` with `{ accepted: true }`" and document how to retrieve the created event (polling, callback, etc.). |
| 6 | High | Correctness | POST required header not documented | src/api.js line 18: POST requires `idempotency-key` header with error if missing; docs/api.md does not mention this requirement. Partners will receive 400 errors if they do not include this header. | Add documentation to docs/api.md POST section: "Requires `idempotency-key` header. Requests without this header receive `400`." Explain idempotency key purpose. |
| 7 | High | Security | Rate limit parameters mismatch | docs/api.md line 18: "100 requests per minute per token"; src/api.js line 8: `max: 600` (600 requests/minute) with `windowMs: 60_000` (1 minute window); src/limit.js line 4: rate limiting keyed by `req.ip` (per-IP, not per-token). Partners will be rate-limited based on IP not token, and at 600/min not 100/min. | Update docs/api.md line 18 to state "600 requests per minute per IP address" OR implement token-based rate limiting as documented. |
| 8 | High | Security | Authentication requirement not implemented | docs/api.md lines 5-6: "Every endpoint requires a bearer token in the `Authorization` header. Requests without one receive `401`"; src/api.js does not implement Authorization header validation. Partners can access endpoints without any token. | Implement authentication middleware in src/api.js to validate Authorization header before route handlers. Return 401 if header is missing or invalid. Add test coverage. |
| 9 | Medium | Reliability | Rate limiter uses Date.now() without validation | src/limit.js line 6: `now = Date.now()` used directly in time-window calculation. No timezone or clock-skew handling. Could cause timing issues under clock adjustments. | Consider using monotonic clock API or adding safeguards for time-window calculations. Test behavior under system time changes. |
| 10 | Info | Maintainability | No error handling for rate limit storage | src/limit.js lines 2-8: Rate limit state stored in in-memory Map. No handling for memory exhaustion, no eviction policy beyond time window. Over time with many IPs, memory could grow unbounded. | Document expected behavior (e.g., "temporary in-memory storage, not for production use"). For production, use external cache (Redis) with eviction policy. |

---

## Unconfirmed Issues

| Finding | Reason Unconfirmed | What's Needed |
|---------|-------------------|--------------|
| Actual event retrieval returns empty results | src/api.js line 26: `loadEvents()` returns `[]` always, but unclear if this is stub/mock or actual implementation. | Code inspection of persistent storage layer or integration tests with real data. |
| Authorization header validation is partially implemented elsewhere | src/api.js does not validate Authorization header in the middleware chain. Could be enforced by Express auth plugin or upstream proxy. | Check if Express.js or related middleware is configured in actual deployment; inspect initialization code not shown. |

---

## Summary

### Strengths

1. **Clear version separation**: Implementation correctly uses `/v2/events` to signal breaking changes from v1, following semantic versioning principles.
2. **Cursor-based pagination**: Implementation uses cursor-based pagination (more robust than page-based), reducing issues with concurrent deletions and providing consistent ordering.
3. **Idempotent POST design**: Requiring `idempotency-key` header is a sound pattern for safe event ingestion, preventing duplicate processing of retried requests.
4. **Test coverage for rate limiting**: Automated test exists for rate limiting middleware (test/limit.test.js), verifying basic functionality.

### Key Risks

**Partners cannot use the API as documented.** All critical issues (findings #1–6) must be resolved immediately:

1. **Endpoint discovery fails** (finding #1): v1 endpoints do not exist; partners will receive 404 from the documented URLs.
2. **Pagination breaks silently** (finding #2–3): Partners using `?page=2` will receive cursor-based results they cannot parse correctly.
3. **Response format mismatch** (findings #4–5): Partners expecting `201` and event body will receive `202` and `{ accepted: true }`.
4. **Missing required header** (finding #6): POST requests without `idempotency-key` fail without documented reason.
5. **Authentication not enforced** (finding #8): No bearer token validation occurs despite being the first documented requirement.
6. **Rate limit contract broken** (finding #7): Actual limits (600/IP) differ from documented (100/token) by 6× and use wrong dimension.

### Priority Order

1. **Critical — Fix endpoint version** (finding #1): Update documentation to `/v2/events` or update code to `/v1/events`. This is the blocking issue for any partner integration.
2. **Critical — Fix authentication** (finding #8): Implement Authorization header validation or remove from documentation if not required. Security requirement cannot be absent in production.
3. **High — Fix pagination documentation** (finding #2–3): Document cursor-based pagination, `?after=<id>` parameter, and `nextCursor` response field. Explain how to fetch first page (omit `?after`).
4. **High — Fix POST response documentation** (finding #4–5): Document 202 status and `{ accepted: true }` response. Document how partners retrieve the created event.
5. **High — Document idempotency key** (finding #6): Add to POST section that `idempotency-key` header is required.
6. **High — Fix rate limit documentation** (finding #7): Align either code or docs. If code is correct, document 600/IP. If docs are correct, implement token-based limiting at 100/min.
7. **Medium — Harden rate limiter** (finding #9): Review time-window logic for clock-skew resilience; consider persistent storage for production.

### Coverage Gaps

**Not examined**:
- Database schema and event storage implementation (loadEvents function returns stub)
- Deployment configuration, reverse proxy, or auth enforcement at network boundary
- Client SDKs or integration documentation
- Load testing or performance benchmarks under the documented 100 req/min limit
- Actual production metrics (error rates, latency, adoption by partners)
- Other endpoints not listed in documentation (if any)
- Non-GET/POST methods (PUT, DELETE, PATCH) and their behavior
- Error response formats for validation failures, missing fields, malformed JSON
- API versioning strategy for future breaking changes
- Role-based access control or per-token rate limit bucketing (currently uses IP)

---

## Verified

**What I verified**: API documentation completeness and accuracy against implementation. Confirmed all GET and POST endpoints exist or are missing; all parameter names, response codes, response formats, and rate limit values match or diverge from docs. Verified rate limiter test passes. No changes made to code or documentation.
