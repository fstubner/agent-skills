# API Documentation Assessment

## Scope

**In scope:**
- API documentation: `docs/api.md`
- API implementation: `src/api.js` (main endpoints and middleware)
- Rate limiting middleware: `src/limit.js`
- Tests: `test/limit.test.js`
- Configuration: `package.json`

**Out of scope:**
- External dependencies and their vulnerability analysis
- Load testing or performance profiling
- Production deployment configuration
- Database or persistence layer (not implemented in current codebase)

**Depth:** Targeted — every file in the in-scope list was read in full and compared systematically.

---

## Environment

**Language and Runtime:**
- Node.js with ES modules (`"type": "module"`)
- JavaScript (not TypeScript)

**Framework:**
- Express.js (inferred from `createApp(express)` pattern and middleware usage)

**Domain:**
- REST API for partner event ingestion

**Build/Test Tooling:**
- npm for package management
- Node's built-in test runner (`node --test`)

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | Approval required — not executed. Can verify the test file exists and has structure: single unit test for rate-limit under-limit case |
| Package.json inspection | Confirmed: test script references `test/limit.test.js` |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | API version mismatch: documentation references `/v1/` endpoints, implementation provides `/v2/` | `docs/api.md` lines 8–14 specify `/v1/events`; `src/api.js` lines 11, 17 implement `/v2/events` | Update documentation to `/v2/` or implement `/v1/` endpoints to match documented contract |
| 2 | Critical | Correctness | Pagination mechanism completely different: docs specify page-based (`?page=2`), implementation uses cursor-based (`?after=<id>`) | `docs/api.md` line 10: "Use `?page=2` for the second page"; `src/api.js` line 12: `const after = req.query.after ?? null` with cursor in response (line 14) | Update docs to describe cursor pagination with `?after=<id>` parameter, or implement page-based pagination in code |
| 3 | Critical | Correctness | Page size mismatch: documentation claims 50 per page, implementation uses 25 | `docs/api.md` line 10: "50 per page"; `src/api.js` line 3: `const PAGE_SIZE = 25` | Update documentation to reflect PAGE_SIZE = 25 |
| 4 | Critical | Correctness | POST response status code mismatch: docs specify `201`, implementation returns `202` | `docs/api.md` line 14: "returns `201`"; `src/api.js` line 19: `res.status(202)` | Update docs to specify `202` or change implementation to return `201` |
| 5 | Critical | Correctness | POST endpoint requires undocumented `idempotency-key` header | `docs/api.md` makes no mention of idempotency-key requirement; `src/api.js` lines 18: checks for `idempotency-key` header, returns 400 if missing | Document the `idempotency-key` requirement in POST `/v2/events` section |
| 6 | Critical | Security | Authentication enforcement missing: docs require bearer token in Authorization header, implementation has no authentication check | `docs/api.md` lines 4–6: "Every endpoint requires a bearer token in the `Authorization` header"; `src/api.js` has no middleware validating Authorization header or token | Add authentication middleware to validate Authorization header on all endpoints, or update docs to remove authentication requirement and clarify actual auth model |
| 7 | Critical | Correctness | Rate limit parameters completely different: docs specify 100 requests/min per token, implementation enforces 600 requests/min per IP | `docs/api.md` lines 17–18: "100 requests per minute per token"; `src/api.js` line 8: `rateLimit({ windowMs: 60_000, max: 600 })` and `src/limit.js` line 4: uses `req.ip` (not token-based) | Update docs to specify 600 requests/min per IP address, or reconfigure rate limiter to track by token and enforce 100/min limit |
| 8 | High | Reliability | Rate limiting logic uses IP address as key, which is unreliable for identifying unique clients behind NAT/proxies | `src/limit.js` line 4: `const key = req.ip` will treat all clients on same network as one entity | For reliable per-token limiting as documented, switch from IP-based to token-based rate limiting |

---

## Unconfirmed Issues

None — all identified issues have specific evidence from code inspection.

---

## Summary

### Strengths

1. **Test coverage exists** — The rate-limit middleware has a unit test (`test/limit.test.js`) demonstrating the functionality for the happy path (requests under limit).
2. **Clean middleware architecture** — Rate limiting is properly implemented as Express middleware with clear separation of concerns (`src/limit.js`).
3. **Modern async handling** — The endpoint implementations use async/await pattern appropriately (`src/api.js` lines 11, 17).

### Key Risks

The API documentation is fundamentally misaligned with the implementation across nearly every aspect:

- **API version**: Docs promise `/v1/`, partners calling that endpoint will receive 404
- **Pagination**: Partners following documented page-based pagination will fail; the implementation requires cursor pagination
- **Page size**: Partners expecting 50 items will receive 25
- **Response codes**: POST will return 202 instead of documented 201
- **Authentication**: Undocumented but critical for POST — the `idempotency-key` header is required but not documented; conversely, the documented Authorization header requirement is not enforced
- **Rate limiting**: Partners implementing per-token rate limiting based on docs (100/min) will encounter different limits (600/min per IP)

This creates immediate integration problems for partners who have already implemented clients based on the published documentation.

### Priority Order

1. **Urgent:** Update `docs/api.md` to match implemented endpoints:
   - Change all `/v1/` references to `/v2/`
   - Document cursor-based pagination with `?after=<id>` and `nextCursor` response field
   - Update page size from 50 to 25
   - Change POST response code from 201 to 202
   - Document the required `idempotency-key` header for POST
   - Update rate limit from 100/min per token to 600/min per IP

2. **High priority:** Implement authentication middleware:
   - Add Bearer token validation to all endpoints as documented
   - This is a security gap — the API is unprotected while docs promise protection

3. **Medium priority:** Evaluate rate limiting strategy:
   - Current IP-based limiting doesn't match documentation (per-token)
   - IP-based rate limiting is unreliable behind proxies; consider using token/API key instead

### Coverage Gaps

- **Test execution**: The `npm test` command requires approval and was not executed; test output not available to verify if tests currently pass
- **Performance testing**: No load tests or latency profiling performed
- **Authentication implementation**: No test coverage was examined for the required Authorization header validation
- **Actual usage patterns**: No access to production logs, error tracking, or partner feedback details
- **Full test suite**: Only `test/limit.test.js` is visible; other test files may exist in the suite
- **Database/persistence layer**: Implementation returns empty array from `loadEvents()` — actual data layer is not implemented
- **API schema validation**: No inspection of request/response schema validation beyond basic header checks

---

## Conclusion

Eight critical mismatches between documentation and implementation were identified, spanning API versioning, pagination mechanism, page size, response codes, required headers, authentication enforcement, and rate limiting configuration. Partners relying on the published documentation will encounter failures on all major use cases. Immediate documentation updates are required; authentication implementation is essential for the stated security contract.
