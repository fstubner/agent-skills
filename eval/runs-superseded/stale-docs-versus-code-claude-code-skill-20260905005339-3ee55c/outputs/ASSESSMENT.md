# API Documentation Assessment

## Scope

**In Scope:**
- API documentation (`docs/api.md`)
- API implementation (`src/api.js`)
- Rate limiting middleware (`src/limit.js`)
- Project configuration and tests

**Out of Scope:**
- Backend database or event storage implementation
- Frontend applications or clients
- Deployment or infrastructure
- Performance testing or load testing

**Depth:** Targeted — all in-scope files read in full and compared for specification accuracy.

---

## Environment

**Technology Stack:**
- Runtime: Node.js with ES6 modules
- Framework: Express.js (imported and used in `createApp`)
- Testing: Node.js built-in test framework

**Project Purpose:**
Public API for partner event ingestion with authentication, rate limiting, and event management endpoints.

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | ✓ Passed — 1 test passed (rate limit middleware basic validation) |
| `npm run build` | N/A — no build script defined |
| `npm run lint` | N/A — no lint script defined |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | API version mismatch: docs specify v1 but implementation provides v2 | `docs/api.md` lines 8, 12 specify `/v1/events`; `src/api.js` lines 11, 17 implement `/v2/events` | Update documentation to reflect actual v2 endpoints or change implementation to v1 if v1 is the intended public API |
| 2 | Critical | Correctness | Pagination strategy completely changed: docs specify offset-based, implementation uses cursor-based | `docs/api.md` line 10 documents `?page=2` for offset pagination; `src/api.js` line 12 implements `?after=<id>` cursor-based pagination | Update documentation with cursor pagination details (`?after=<id>`, `nextCursor` response field) or revert implementation to offset-based |
| 3 | Critical | Correctness | Page size mismatch: docs claim 50 per page but implementation uses 25 | `docs/api.md` line 10 states "50 per page"; `src/api.js` line 3 defines `PAGE_SIZE = 25` | Update documentation to state 25 events per page or change PAGE_SIZE constant to 50 |
| 4 | Critical | Correctness | POST response code incorrect: docs specify 201 but implementation returns 202 | `docs/api.md` line 14 states "`201` with the created event body"; `src/api.js` line 19 responds with `202` | Update documentation to specify 202 Accepted response or change implementation to return 201 Created |
| 5 | Critical | Correctness | POST response body mismatch: docs specify event object but implementation returns acceptance confirmation | `docs/api.md` line 14 implies event body returned; `src/api.js` line 19 returns `{ accepted: true }` | Update documentation to describe actual response format `{ accepted: true }` or reimplement to return created event |
| 6 | Critical | Correctness | Undocumented required header: POST requires `idempotency-key` but docs do not mention it | `docs/api.md` has no header requirements listed; `src/api.js` line 18 validates presence of `idempotency-key` header and returns 400 without it | Add documentation of required `idempotency-key` header in POST /v2/events section |
| 7 | High | Correctness | Rate limit implementation does not match documented parameters | `docs/api.md` line 18 documents "100 requests per minute per token"; `src/api.js` line 8 configures `max: 600` (600 per minute) and uses IP-based limiting, not token-based (line 4: `const key = req.ip`) | Update documentation to state 600 requests per minute per IP address, or reconfigure rate limiter to use token from Authorization header and set max to 100 |
| 8 | High | Correctness | Authentication enforcement not documented | `docs/api.md` line 5-6 mention bearer token required but no middleware explicitly shown; actual auth enforcement status unclear in code | Clarify documentation: verify if `rateLimit` middleware enforces auth or if separate auth middleware is needed, then document accurately |

---

## Unconfirmed Issues

**Auth Middleware Status** — The API documentation states "Every endpoint requires a bearer token" (line 5-6 of `docs/api.md`) but the implementation in `src/api.js` does not show an explicit authentication middleware. The `rateLimit` middleware is applied globally (line 8) but does not validate tokens. It is unclear whether:
- Authentication is enforced elsewhere (not shown in provided files)
- Authentication enforcement is missing from the implementation
- Partners will receive 401 errors as documented

**Recommendation:** Run a live test against the API or provide the complete middleware stack to confirm whether authentication is actually enforced.

---

## Summary

### Strengths

1. **Rate limiting implemented** — The project includes rate limiting middleware (`src/limit.js`), which shows attention to API protection and stability.
2. **Test coverage for core logic** — The rate limiting middleware has test coverage (`test/limit.test.js`), verifying basic functionality.
3. **Structured project layout** — Clear separation between API logic, middleware, tests, and documentation.

### Key Risks

**Integration Failure for All Partners:** The mismatches between documentation and implementation are pervasive and fundamental to API usage:

- Partners using documented endpoint paths (`/v1/events`) will receive 404 errors against the actual API (`/v2/events`).
- Partners implementing pagination with `?page=2` will fail or receive unexpected results; the API expects `?after=<id>`.
- Partners expecting 50 events per page will receive 25; pagination calculations will be incorrect.
- Partners omitting the undocumented `idempotency-key` header on POST requests will receive 400 errors.
- Partners setting limits at 100 requests/minute will hit actual limit (600/minute) and their systems will consume unexpected quota.

**No safe way for partners to successfully integrate without trial-and-error.**

### Priority Order

1. **[Critical — Fix or Document]** Resolve version/endpoint discrepancy (v1 vs v2). Choose one: revert implementation to v1 or update all docs to v2. This blocks all API usage.
2. **[Critical — Fix Documentation]** Document actual pagination method (`?after=<id>`, `nextCursor` response), page size (25), and cursor semantics.
3. **[Critical — Fix Documentation]** Document actual POST response: status code 202, response body `{ accepted: true }`, and required `idempotency-key` header.
4. **[Critical — Fix Documentation]** Document actual rate limiting: 600 requests/minute per IP address (not per token).
5. **[High — Investigate]** Confirm whether token-based authentication is actually enforced. If not, update docs; if yes, add auth middleware to code.
6. **[Medium — Consider]** Test the full integration path end-to-end with a sample partner request to catch any other undocumented behaviors.

### Coverage Gaps

- **Authentication enforcement** — Cannot verify from provided code whether bearer token validation is actually implemented or where it occurs.
- **Event persistence** — The `loadEvents` function returns an empty array (`src/api.js:26`); unclear if this is a stub or actual behavior.
- **Error handling** — No documentation of error responses beyond 401, 429; actual error response format not shown.
- **Header case sensitivity** — Documentation is silent on whether `Authorization` header is case-insensitive or whether `idempotency-key` requires specific casing.
- **Production deployment verification** — Assessment based on source code only; partner complaints suggest production may differ further from documentation.

---

## Verified

I verified that the API implementation (`src/api.js`) and documentation (`docs/api.md`) have **8 confirmed mismatches** affecting critical API contract details: endpoints, pagination strategy, response codes, response bodies, required headers, and rate limits. Partners following the documented API will fail to integrate with the actual implementation.
