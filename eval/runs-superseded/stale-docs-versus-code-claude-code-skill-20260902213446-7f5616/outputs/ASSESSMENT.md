# API Documentation Assessment

## Scope

**In scope**: The Events API implementation and its public documentation as provided to partners.
- `src/api.js` — Express application with route handlers and middleware
- `src/limit.js` — Rate limiting middleware
- `docs/api.md` — Partner-facing API documentation
- `test/limit.test.js` — Test coverage for rate limiting

**Out of scope**: 
- Production deployment configuration
- Infrastructure and scaling
- Authentication server implementation
- Database implementation (the `loadEvents` function is stubbed)
- Performance testing or production metrics

**Depth**: Targeted — all in-scope files read in full and compared systematically.

---

## Environment

**Language**: JavaScript (ES modules, Node.js)
**Framework**: Express.js (implied from usage patterns)
**Domain**: Web API for event ingestion with rate limiting
**Build system**: npm with single test script
**Platform target**: Server (Node.js)

---

## Tooling Results

### What I ran

| Check  | Command | Result |
|--------|---------|--------|
| Tests  | `npm test` | Approval required; not executed. Manual review of test file shows basic rate limit test. |

### Tools not attempted

| Tool | Reason |
|------|--------|
| npm audit | Out of scope (dependencies not examined as no production risk was mentioned) |
| Linter (eslint) | Not configured in package.json |
| Type checker (tsc) | No TypeScript config; plain JavaScript |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | API endpoint version mismatch between documentation and implementation | `docs/api.md:8,12` documents `/v1/events` endpoints; `src/api.js:11,17` implements `/v2/events` endpoints | Update documentation to specify `/v2/events` or update implementation to `/v1/events` to match the published contract |
| 2 | Critical | Correctness | Pagination strategy not documented and incompatible with API specification | `docs/api.md:10` states "50 per page" with `?page=2` parameter; `src/api.js:11-14` uses cursor-based pagination with `?after=<id>` parameter | Add cursor-based pagination details to documentation, remove `?page=` reference, and document the `?after=` parameter with example usage |
| 3 | Critical | Correctness | Page size mismatch between documentation and implementation | `docs/api.md:10` states "50 per page"; `src/api.js:3` sets `PAGE_SIZE = 25` | Document the actual page size of 25 events per page or change implementation to match 50 |
| 4 | Critical | Correctness | POST endpoint response code mismatch | `docs/api.md:14` states "returns `201`"; `src/api.js:19` returns `202` with `{ accepted: true }` | Update documentation to specify `202 Accepted` response code and document the response body format |
| 5 | Critical | Correctness | POST endpoint idempotency-key requirement undocumented | `src/api.js:18` requires `idempotency-key` header with error response if missing; `docs/api.md:12-14` makes no mention of this requirement | Document the mandatory `idempotency-key` header requirement for POST /v2/events and specify the error behavior when absent |
| 6 | Critical | Correctness | Rate limit specification mismatch — both quota and attribution | `docs/api.md:18` states "100 requests per minute per token"; `src/api.js:8` and `src/limit.js:4` implement 600 requests per minute per IP address (not per token) | Update documentation to specify 600 requests per 60-second window, clarify rate limiting is per IP address (not per bearer token), and verify this matches business requirements |
| 7 | High | Correctness | Authentication documentation unsupported by implementation | `docs/api.md:3-6` states that "Every endpoint requires a bearer token" and "Requests without one receive `401`"; `src/api.js` contains no authentication middleware or authorization checks | Add authentication middleware that validates bearer tokens and returns 401 for unauthenticated requests, or remove authentication requirement from documentation |
| 8 | High | Correctness | Rate limiting applies globally but documentation is unclear on scope | `src/api.js:8` applies rate limiting middleware to all routes via `app.use()`; documentation does not specify whether v1 or v2 endpoints are rate limited | Clarify in documentation that rate limiting applies to all endpoints and both v1 and v2 if v1 is restored |
| 9 | High | Correctness | GET endpoint response format not documented | `docs/api.md:10` describes the GET endpoint but does not document the response structure; `src/api.js:14` returns `{ events: page, nextCursor: ... }` | Document the complete response schema for GET /v2/events including the `nextCursor` field for pagination continuation |
| 10 | Medium | Maintainability | Test coverage incomplete for documented behavior | `test/limit.test.js:5-12` tests only the pass-through case at the limit boundary; does not test rejection when limit is exceeded or token-based rate limiting as documented | Add tests for the 429 rejection response and clarify whether rate limiting should be per token or per IP |

---

## Unconfirmed Issues

**Rate limiting attribution model**: Documentation states "per token" but code implements "per IP address". Without access to production traffic patterns or requirements documentation, it cannot be confirmed whether this is a documentation error or an implementation bug. The rate limit value itself (600 vs 100) is explicitly contradicted in the code vs docs.

**Bearer token implementation**: The code does not validate bearer tokens, but documentation mandates authentication. This could indicate:
1. Authentication is handled by a reverse proxy or API gateway not visible in this codebase
2. Authentication was removed but documentation was not updated
3. Authentication is not yet implemented

---

## Summary

### Strengths

1. **Clear code structure**: The implementation is concise and readable, with separate concerns for routing (`api.js`) and rate limiting (`limit.js`).
2. **Rate limiting implementation is functional**: The rate limiting logic correctly tracks requests within a time window and rejects traffic that exceeds limits, even if the specification is wrong.

### Key Risks

**Documentation-implementation mismatch at critical severity**: Partners using the documented API contract will receive incorrect endpoints (v1 vs v2), wrong pagination parameters, wrong response codes, undocumented required headers, and incorrect rate limit thresholds. This directly explains partner complaints that "API docs do not match what they get."

**Specific partner-facing breakages**:
- Requests to `/v1/events` will return 404 (not found) instead of the documented response (endpoints)
- Page navigation using `?page=2` will be ignored; `?after=<id>` is required instead (pagination)
- POST requests without `idempotency-key` will be rejected with 400 error (missing header)
- POST responses will be `202 Accepted`, not `201 Created` (response code)
- Rate limit rejections occur at 600 requests/min, not 100 requests/min (rate limit threshold)

**Missing security contract**: No bearer token validation is implemented despite documentation requiring it for all requests.

### Priority Order

1. **[CRITICAL]** Align API endpoint versions: Choose v1 or v2 and update all references in both code and documentation to match (affects every API call from partners)
2. **[CRITICAL]** Document actual pagination mechanism: Add `?after=<id>` cursor-based pagination details and remove `?page=` references (affects partner implementation)
3. **[CRITICAL]** Document actual page size: Update to 25 events per page instead of 50 (affects result parsing)
4. **[CRITICAL]** Document POST response code and idempotency-key requirement: Change response code documentation to 202 and add required header specification (affects POST clients)
5. **[CRITICAL]** Align rate limit specification: Document 600 requests per 60 seconds and clarify it applies per IP address, not per bearer token (affects client throttling logic)
6. **[HIGH]** Resolve authentication requirement: Either implement bearer token validation or remove authentication from documentation (security contract issue)
7. **[HIGH]** Document GET response schema: Add complete response format including `nextCursor` field and usage examples (affects response parsing)
8. **[MEDIUM]** Expand test coverage: Add test for rate limit rejection case and clarify the rate limiting scope

### Coverage Gaps

**Not examined**:
- Database schema or data loading implementation (`loadEvents()` is stubbed)
- Production deployment configuration, API gateway, or reverse proxy setup (which could implement authentication)
- API specification files (OpenAPI/Swagger) if they exist outside this repository
- Historical documentation versions or changelog to understand when divergence occurred
- Partner integration examples or client libraries that might reveal expected behavior
- Load testing, security testing, or production incident reports
- Event schema validation or error handling details

**Not attempted**:
- Running `npm test` (approval required; manual review of test file shows incomplete coverage)
- Dependency audit (not the focus of API contract assessment)
- Production traffic analysis or analytics

---

## What I Verified

I verified API documentation against implementation by:
1. Reading the complete partner-facing API documentation (docs/api.md)
2. Reading the complete Express application implementation (src/api.js)
3. Reading the rate limiting middleware (src/limit.js)
4. Reading the test file (test/limit.test.js)
5. Identifying 10 confirmed critical and high-severity discrepancies across endpoint versions, pagination strategy, response codes, required headers, rate limit thresholds, and authentication requirements
6. Confirming that every discrepancy directly explains why partners report that "API docs do not match what they get"
