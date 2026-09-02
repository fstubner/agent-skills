# API Documentation Assessment

## Scope

**In scope**: 
- API documentation (`docs/api.md`)
- API implementation (`src/api.js`)
- Rate limiting implementation (`src/limit.js`)
- Tests (`test/limit.test.js`)

**Out of scope**:
- Production deployment and runtime behavior
- Database/persistence layer (not implemented)
- Partner integration testing or usage data
- Network infrastructure and routing

**Depth**: Targeted — every source file read in full.

---

## Environment

**Languages and runtimes**: JavaScript/Node.js (ES modules)

**Frameworks and libraries**: Express.js (imported but not included in package.json), Node.js built-in `test` module

**Domain**: Web API for event ingestion

**Build system**: npm

**Main entry point**: `src/api.js`

---

## What I Ran

**Command**: `npm test` / `node --test test/limit.test.js`
**Status**: Unable to run — requires permissions to execute Node.js scripts in this environment
**Impact**: Test output not available; assessment based on code review only

---

## Findings Table

| # | Severity | Area         | Finding | Evidence | Recommendation |
|---|----------|--------------|---------|----------|-----------------|
| 1 | Critical | Correctness | API version mismatch: documentation describes `/v1/` endpoints but implementation uses `/v2/` | `docs/api.md:8,12` describes `/v1/events`; `src/api.js:11,17` implements `/v2/events` | Update `docs/api.md` to reference `/v2/events` or update `src/api.js` to serve `/v1/events` to match documentation |
| 2 | Critical | Security | Authentication not implemented: documentation requires bearer token in Authorization header but code has no auth middleware | `docs/api.md:3-6` states authentication required and missing token returns 401; `src/api.js:1-22` contains no authentication middleware | Add authentication middleware to validate bearer tokens and return 401 for missing/invalid tokens, or remove auth requirement from documentation |
| 3 | High | Correctness | Rate limit mismatch: documentation states 100 requests/minute but code enforces 600 requests/minute | `docs/api.md:18` states "100 requests per minute"; `src/api.js:8` configures `max: 600` with `windowMs: 60_000` | Update rate limit configuration to `max: 100` in `src/api.js:8` or update documentation to state 600 requests/minute |
| 4 | High | Correctness | Rate limit tracking method mismatch: documentation implies per-token limits but code tracks per IP address | `docs/api.md:18` states "per token"; `src/limit.js:4` uses `req.ip` as the rate limit key, not token-based tracking | Clarify documentation if per-IP is intended, or implement token-based tracking in rate limiter |
| 5 | High | Correctness | Pagination method mismatch: documentation describes offset-based pagination but code implements cursor-based pagination | `docs/api.md:10` states "50 per page" with `?page=2` for second page; `src/api.js:11-14` uses cursor-based `?after=<id>` parameter | Update documentation to describe cursor-based pagination with `?after` parameter, or refactor code to use offset-based `?page` parameter |
| 6 | High | Correctness | Page size mismatch: documentation states 50 events per page but code returns 25 | `docs/api.md:10` states "50 per page"; `src/api.js:3` sets `PAGE_SIZE = 25` | Update documentation to state 25 events per page or change `PAGE_SIZE` to 50 |
| 7 | High | Correctness | POST response status code mismatch: documentation states 201 Created but code returns 202 Accepted | `docs/api.md:14` states "returns 201"; `src/api.js:19` returns `res.status(202)` | Update documentation to state 202 Accepted or change code to return 201 Created |
| 8 | High | Correctness | POST response body mismatch: documentation states event body returned but code returns `{accepted: true}` | `docs/api.md:14` states "returns... the created event body"; `src/api.js:19` returns `res.status(202).json({ accepted: true })` | Update documentation to describe `{accepted: true}` response or implement event creation and return event body |
| 9 | High | Correctness | POST undocumented requirement: idempotency-key header required by code but not mentioned in documentation | `src/api.js:18` checks for and requires `idempotency-key` header, returning 400 if missing; `docs/api.md:12-14` makes no mention of this requirement | Document the required `idempotency-key` header requirement in `docs/api.md` section for POST /v2/events |

---

## Unconfirmed Issues

**Unable to confirm via test execution**: Test suite (`test/limit.test.js`) could not be executed due to environment restrictions. The single test verifies rate limiting behavior for requests under the limit (allows 2 requests with `max: 2`), but full test coverage could not be validated.

---

## Summary

### Strengths

- **Clear documentation structure**: The API documentation is well-organized with distinct sections for authentication, endpoints, and rate limits, making it easy to read.
- **Modular code organization**: Rate limiting logic is correctly separated into its own module (`src/limit.js`) with a clean middleware interface.

### Key Risks

The API documentation and implementation are fundamentally misaligned across nearly every dimension:

1. **Critical Security Gap (Finding #2)**: Authentication is completely absent from the implementation despite being documented as required. Partners following the documentation will fail to add authentication, creating a security risk.

2. **Complete Endpoint Mismatch (Findings #1, #5, #6, #7, #8, #9)**: The endpoints differ in version, pagination approach, page size, response status, response body, and undocumented requirements. A partner integrating based on the documentation will integrate against the wrong API contract.

3. **Rate Limit Discrepancy (Findings #3, #4)**: The enforced rate limit (600/min per IP) is 6x higher than documented (100/min per token), and the tracking method differs. Partners will get different rate limiting behavior than expected.

### Priority Order

1. **Choose and align on /v1 vs /v2** — decide whether to update code to serve `/v1/events` or update docs to reference `/v2/events`. This is foundational; everything else depends on which version is official. *(Critical)*

2. **Implement or remove authentication** — partners cannot safely integrate without this. If authentication is required, add middleware; if not, remove from docs. *(Critical)*

3. **Align rate limit enforcement** — decide whether 100 or 600 requests/minute is correct, and whether per-token or per-IP is the intended model. Update code and docs to match. *(High)*

4. **Standardize pagination method** — decide between offset-based (`?page=2`) and cursor-based (`?after=<id`) approaches. Update whichever is wrong. Include page size (25 vs 50) in the same fix. *(High)*

5. **Align POST response contract** — decide on status code (201 vs 202) and response body (event details vs `{accepted: true}`). Document idempotency-key requirement. *(High)*

### Coverage Gaps

- **Automated tests**: Test file exists but could not be executed; test coverage of documentation accuracy is unknown.
- **Runtime behavior**: Actual request/response flow with real HTTP client not tested.
- **Database/storage**: `loadEvents()` returns empty array; persistence layer not implemented or reviewed.
- **Production deployment**: No visibility into how API runs in production or what actual partners experience.
- **Error cases**: Edge cases (invalid tokens, malformed requests, network errors) not examined beyond what code shows.

---

## Verified Findings

**Verified through code review**:
- API version mismatch: `/v1` (docs) vs `/v2` (code)
- Authentication absent from implementation
- Rate limit configuration: 600/min (code) vs 100/min (docs)
- Rate limit tracking: by IP (code) vs by token (docs)
- Pagination: cursor-based with 25 items (code) vs offset-based 50 items (docs)
- POST response: 202 with `{accepted: true}` (code) vs 201 with event body (docs)
- Undocumented idempotency-key header requirement
