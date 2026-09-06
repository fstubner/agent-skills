# Engineering Assessment: Events API

## 1. Scope

- **In Scope**: All codebase files in repository (`README.md`, `package.json`, `docs/api.md`, `src/api.js`, `src/limit.js`, `test/limit.test.js`).
- **Out of Scope**: External infrastructure, deployment pipelines, production database configurations, client applications.
- **Depth**: `deep` — Every file in the repository was read and inspected in full, automated tests were executed, and code behavior was mapped against documentation contract specifications.

---

## 2. Environment

- **Language & Runtime**: JavaScript (ES Modules, Node.js native test runner).
- **Frameworks**: Express.js (expected in `createApp(express)` factory).
- **Tooling**: `npm` / `node --test`.

---

## 3. Tooling Results (What I Ran)

The project defines a single test script in `package.json`. Below is the exact command executed and its output.

### Command 1: `npm test`

```
> test
> node --test test/limit.test.js

✔ requests under the limit pass through (0.8446ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 127.1557
```

**Outcome**: Test passed (1 test, 0 failures).

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | High | Security / Correctness | Authentication missing | `docs/api.md:5-6` states all endpoints require Bearer token and return `401`. `src/api.js:5-23` contains no authentication middleware or token checks. | Add authentication middleware checking `Authorization` header or update docs if auth is handled at an API gateway. |
| 2 | High | Correctness / API Contract | Endpoint URL version mismatch (`/v1` vs `/v2`) | `docs/api.md:8,12` documents `GET /v1/events` and `POST /v1/events`. `src/api.js:11,17` implements `/v2/events`. Calling `/v1/events` yields `404`. | Align docs and implementation on API versioning strategy (either support `/v1` routes or update documentation to `/v2`). |
| 3 | High | Correctness / API Contract | `GET /events` pagination model mismatch | `docs/api.md:10` specifies offset pagination (`?page=2`, 50 items/page). `src/api.js:3,10-15` implements cursor pagination (`?after=<id>`, 25 items/page, returns `nextCursor`). | Update `docs/api.md` to document cursor-based `?after` pagination and 25-item page size (or update implementation). |
| 4 | High | Correctness / API Contract | `POST /events` response code, body, and header mismatch | `docs/api.md:14` states `POST` returns `201` with created event body. `src/api.js:17-20` requires undocumented `idempotency-key` header (400 if missing), returns status `202`, and body `{ accepted: true }`. | Update `docs/api.md` to document mandatory `idempotency-key` header, `202 Accepted` status, and response schema `{ accepted: true }`. |
| 5 | Medium | Correctness / Rate Limiting | Rate limit threshold and identifier mismatch | `docs/api.md:18` states limit is 100 req/min per token. `src/api.js:8` sets limit to 600 req/min, and `src/limit.js:4` keys by IP address (`req.ip`) instead of token. | Update `docs/api.md` or `src/api.js`/`src/limit.js` so rate limit threshold (100 vs 600) and identifier (IP vs Token) match. |
| 6 | Medium | Reliability / Performance | Rate limiter memory leak | `src/limit.js:2-10` updates timestamps for IP keys in `hits` Map but never deletes keys when timestamp array becomes empty, causing unbounded memory growth. | Clean up stale keys in `hits` Map when `window.length === 0` or use an expiring cache structure. |
| 7 | Medium | Maintainability / Testing | Insufficient test coverage | `test/limit.test.js:1-14` contains only 1 unit test for happy-path rate limiting. `src/api.js` has zero route or integration tests. | Add suite of route tests covering endpoint contracts, missing headers (`idempotency-key`), pagination query params, and rate limit responses. |

---

## 5. Unconfirmed Issues

- **Upstream Authentication / Gateway**: It is unconfirmed whether authentication is expected to be handled upstream by an API gateway (e.g. Kong, AWS API Gateway) before requests reach Express `createApp()`. If an upstream gateway exists, `docs/api.md` may describe gateway behavior rather than application code responsibilities.

---

## 6. Summary

### Strengths
1. **Clean Code Structure**: The codebase uses modern ES Module syntax (`import`/`export`), clean separation of rate-limiting middleware (`src/limit.js`), and express factory pattern (`createApp`).
2. **Idempotency Protection**: `POST /v2/events` explicitly checks for `idempotency-key` header to prevent duplicate event submissions.

### Key Risks
1. **Partner Integration Failure (High)**: Partners following `docs/api.md` will experience widespread integration failures: requests to `/v1/events` return 404, offset `?page=2` params are ignored, `POST` requests without `idempotency-key` fail with HTTP 400, and expected HTTP 201 response object is instead HTTP 202 `{ accepted: true }`.
2. **Unbounded Memory Leak (Medium)**: In production environments with high unique client IP traffic, `src/limit.js` will leak memory as `hits` Map entries accumulate indefinitely.

### Priority Order
1. **Align API Version & Endpoint Documentation (Finding #2)**: Update `docs/api.md` to reflect `/v2/events` (or add route aliases) so partner requests do not fail with HTTP 404.
2. **Update Request/Response Specifications (Finding #4)**: Document `idempotency-key` requirement and HTTP 202 response for `POST /v2/events`.
3. **Update Pagination Specifications (Finding #3)**: Document `?after` cursor parameter and 25-item page limit.
4. **Implement/Document Authentication (Finding #1)**: Add auth middleware or document gateway auth requirements.
5. **Harmonize Rate Limiting (Finding #5)**: Align rate limit rate (100 vs 600 req/min) and keying mechanism (Token vs IP).
6. **Fix Memory Leak in Rate Limiter (Finding #6)**: Delete empty entries from `hits` Map in `src/limit.js`.
7. **Expand Test Suite (Finding #7)**: Add integration tests verifying API endpoint behavior and error conditions.

### Coverage Gaps
- **Production Infrastructure & Gateway Config**: Gateway, reverse proxy, or load balancer configurations sitting in front of Express app were not available.
- **Load / Stress Testing**: High concurrency testing was not performed to measure rate limiter performance under heavy load.
