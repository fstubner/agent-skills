# Engineering Assessment: Events API

## 1. Scope

- **In scope**: All repository source files, documentation, configuration, and test scripts:
  - `README.md`
  - `package.json`
  - `docs/api.md`
  - `src/api.js`
  - `src/limit.js`
  - `test/limit.test.js`
- **Out of scope**: External Express library internals, production deployment infrastructure, API gateway / reverse proxy configurations.
- **Depth**: `deep` — every file in the repository was read and analyzed in full; all declared project scripts and available automated check tools were executed and their output recorded verbatim.

---

## 2. Environment

- **Languages and Runtimes**: JavaScript (Node.js ES modules, `"type": "module"`).
- **Frameworks and Libraries**: Express (passed to `createApp(express)`), Node.js native test runner (`node:test`, `node:assert`).
- **Domain**: Public API / Partner Event Ingestion service (`events-api`).
- **Platform Targets**: Node.js server environment.
- **Build Systems and Tooling**: npm (`package.json`), Node.js test runner (`node --test`).

---

## 3. Tooling Results

### What I Ran

#### 1. Test Suite (`npm test`)
- **Command**: `npm test`
- **Exit Code**: `0`
- **Output**:
```text
> test
> node --test test/limit.test.js

✔ requests under the limit pass through (0.9593ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 125.2156
```

#### 2. Dependency Security Audit (`npm audit`)
- **Command**: `npm audit`
- **Exit Code**: `1`
- **Output**:
```text
npm error code ENOLOCK
npm error audit This command requires an existing lockfile.
npm error audit Try creating one first with: npm i --package-lock-only
npm error audit Original error: loadVirtual requires existing shrinkwrap file
```

### Summary of Automated Checks
- **Tools run successfully**: `npm test` (1 test passed, 0 failed).
- **Tools that failed**: `npm audit` (failed due to missing `package-lock.json`).
- **Tools unavailable**: `eslint`, `prettier`, `tsc`, `mypy` (no configurations or packages present in repository).
- **Tools not attempted**: None.

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | Critical | Security | Public API endpoints lack authentication enforcement. | `src/api.js:5-23` implements no authentication middleware or token verification, while `docs/api.md:5-6` states every endpoint requires a bearer token and returns `401`. | Implement bearer token authentication middleware in `src/api.js` to validate `Authorization` headers and return HTTP `401` when missing or invalid. |
| 2 | High | Reliability | API endpoint version mismatch (`/v1` in docs vs `/v2` in code). | `src/api.js:11,17` registers `/v2/events` for GET and POST, whereas `docs/api.md:8,12` documents `GET /v1/events` and `POST /v1/events`. | Align route definitions in `src/api.js` and documentation in `docs/api.md` so endpoint paths match. |
| 3 | High | Reliability | Incompatible GET events pagination contract and page size. | `src/api.js:3,11-15` implements cursor-based pagination (`?after=<id>`) with `PAGE_SIZE = 25` returning `{ events, nextCursor }`, whereas `docs/api.md:10` documents page-based pagination (`?page=2`) returning 50 events per page. | Reconcile pagination model, default limit, and response payload structure between `src/api.js` and `docs/api.md`. |
| 4 | High | Reliability | Incompatible POST events response contract and undocumented header. | `src/api.js:17-20` enforces a mandatory `idempotency-key` header (returning HTTP 400 if absent) and returns HTTP 202 `{ accepted: true }`, whereas `docs/api.md:14` states POST returns HTTP 201 with created event body and omits `idempotency-key`. | Document `idempotency-key` in `docs/api.md` and align HTTP status code (201 vs 202) and response body contract. |
| 5 | High | Security / Reliability | Rate limiter keying and limit threshold mismatch. | `src/api.js:8` configures 600 requests/min and `src/limit.js:4` keys requests by `req.ip`, whereas `docs/api.md:18` specifies a limit of 100 requests/min per token. | Update rate limiter in `src/limit.js` to extract and key by authentication token, and align threshold (`max`) with documented limits. |
| 6 | Medium | Reliability | Rate limiter off-by-one condition permits extra request before throttling. | `src/limit.js:9` checks `if (window.length > max)`, allowing `max + 1` requests within the window before returning HTTP 429. | Update condition in `src/limit.js:9` to `if (window.length >= max)` to enforce exact rate limit thresholds. |
| 7 | Medium | Maintainability | Incomplete test suite with zero coverage for API routes and failure paths. | `test/limit.test.js:5-13` contains a single unit test testing `rateLimit` under-limit success; no tests exist for HTTP 429 throttling, window expiry, or any endpoints in `src/api.js`. | Add integration tests covering `src/api.js` endpoints (GET/POST status codes, headers, pagination) and unit tests for rate limit edge cases. |
| 8 | Low | Maintainability | Missing package lockfile and explicit `express` dependency. | `package.json:1-6` lists no `dependencies` (omitting `express`), causing `npm audit` to fail due to missing `package-lock.json`. | Add `express` to `dependencies` in `package.json` and generate `package-lock.json`. |

---

## 5. Unconfirmed Issues

1. **Reverse Proxy IP Resolution**:
   - `src/limit.js:4` relies directly on `req.ip` for client identification. If deployed behind a reverse proxy or load balancer without setting `app.set('trust proxy', ...)` in Express, `req.ip` will resolve to the proxy's IP address, causing all client requests to share a single rate limiting bucket.
   - *Confirmation required*: Inspection of production server initialization and deployment topology outside this repository.

---

## 6. Summary

### Strengths
1. **Clean Code Structure**: Clear separation between route handler declarations (`src/api.js`) and rate limiting middleware (`src/limit.js`).
2. **Modern Tooling Baseline**: Uses standard Node.js ES modules (`"type": "module"`) and native test runner (`node:test`, `node:assert`) without external transpilation complexity.

### Key Risks
1. **Security Exposure**: Unauthenticated public endpoints (Finding #1) allow unauthorized users to query and submit event data.
2. **Total Integration Breakdown**: Severe discrepancies between `docs/api.md` and `src/api.js` across endpoint URLs (`/v1` vs `/v2`), pagination models, HTTP status codes (`201` vs `202`), required headers (`idempotency-key`), and rate limit parameters (Findings #2, #3, #4, #5) cause partner requests to fail.

### Priority Order
1. **Enforce Authentication** (Finding #1): Add bearer token validation middleware to protect endpoints.
2. **Reconcile API Specifications and Implementation** (Findings #2, #3, #4): Align route paths (`/v1` vs `/v2`), pagination style (`page` vs `after`), header requirements (`idempotency-key`), and HTTP return codes.
3. **Correct Rate Limiting Logic** (Findings #5, #6): Key rate limiting by token instead of IP, match documented rates, and fix off-by-one threshold check (`>=`).
4. **Expand Automated Test Suite** (Finding #7): Add integration tests for route handlers and rate limiter boundary cases.
5. **Fix Package Management** (Finding #8): Declare `express` dependency and commit `package-lock.json`.

### Coverage Gaps
- **Production Server & Gateway Config**: Production Express setup, reverse proxy headers, and TLS termination details were unavailable.
- **Performance & Load Testing**: No stress tests or concurrency benchmarks were performed.
- **Static Analysis**: Linter (`eslint`) and type checker (`tsc`) rules were unavailable and could not be evaluated.
