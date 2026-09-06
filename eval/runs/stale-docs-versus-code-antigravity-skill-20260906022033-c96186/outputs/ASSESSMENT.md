# Engineering Assessment: Events API & Documentation Discrepancies

## 1. Scope

- **In Scope**: All files and directories within the repository:
  - Configuration & Docs: `README.md`, `docs/api.md`, `package.json`
  - Source Code: `src/api.js`, `src/limit.js`
  - Tests: `test/limit.test.js`
- **Out of Scope**: External infrastructure, deployment environments, production database setup, and live network routing.
- **Depth**: `deep` — Every file in the repository was read in full, and all available project commands (`npm test`) were executed and recorded.

---

## 2. Environment

- **Languages & Runtimes**: Node.js (v18+ with ES modules support and `node:test` runner).
- **Frameworks & Libraries**: Express.js (used via dependency injection in `src/api.js`).
- **Domain**: REST API service for event ingestion and retrieval.
- **Platform Targets**: Server-side Node.js environment.
- **Build Systems & Tooling**: npm, Node.js built-in test runner (`node --test`).

---

## 3. Tooling Results (What I Ran)

### Automated Commands Executed

#### Command: `npm test`
- **Status**: PASSED (Exit Code: 0)
- **Raw Output**:
```text
> test
> node --test test/limit.test.js

✔ requests under the limit pass through (1.0267ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 133.6972
```

### Tool Status Summary
- **Tools run successfully**: `npm test` (Node test runner executing `test/limit.test.js`).
- **Tools unavailable**: Linting (`eslint`), type checking (`tsc`), formatting (`prettier`), and audit tools (no scripts or configs defined in `package.json`).
- **Tools not attempted**: None.

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | **High** | Security / Auth | Missing authentication enforcement across all endpoints. | `docs/api.md:L5-6` vs `src/api.js:L5-23` | Implement authentication middleware in `src/api.js` to validate bearer tokens in the `Authorization` header and return `401` when missing/invalid. |
| 2 | **High** | Correctness / API Contract | Endpoint version mismatch between documentation (`v1`) and implementation (`v2`). | `docs/api.md:L8,L12` vs `src/api.js:L11,L17` | Align path versions across `src/api.js` and `docs/api.md` (either migrate endpoints to `/v1` or update documentation to `/v2`). |
| 3 | **High** | Correctness / API Contract | Pagination strategy and page size mismatch on `GET /events`. | `docs/api.md:L10` vs `src/api.js:L3,L11-15` | Reconcile pagination contract: docs specify offset `?page=2` (50 items/page), while code implements cursor `?after=<id>` (25 items/page). |
| 4 | **High** | Correctness / API Contract | `POST /events` response status, payload, and undocumented header requirement mismatch. | `docs/api.md:L14` vs `src/api.js:L17-20` | Document required `idempotency-key` header and `202 Accepted` response (or adjust `src/api.js` to accept requests without header and return `201 Created` with event body). |
| 5 | **Medium** | Reliability / Rate Limiting | Rate limiting strategy keys on IP address rather than token, with a limit mismatch (600 vs 100). | `docs/api.md:L18` vs `src/api.js:L8` & `src/limit.js:L4` | Update `src/limit.js` to key rate limits per token (`Authorization` header) and adjust `max` in `src/api.js` from `600` to `100` (or update docs to reflect IP-based 600 req/min limit). |
| 6 | **Medium** | Maintainability / Testing | Complete lack of automated unit or integration test coverage for API routes and middleware behavior. | `test/limit.test.js:L1-14` vs `src/api.js:L5-23` | Add comprehensive route tests covering authentication, route paths, pagination, `idempotency-key` checks, status codes, and rate limiting error responses. |

---

## 5. Unconfirmed Issues / Requires Investigation

1. **Database & Data Ingestion Persistence**:
   - `src/api.js:L25-27` contains a stubbed `loadEvents` function returning an empty array `[]`. It is unconfirmed whether actual data persistence exists in another layer or is pending implementation.
2. **Package Dependency Declarations**:
   - `package.json` does not declare `express` as a dependency. `src/api.js` exports `createApp(express)`, expecting `express` to be passed in. If this is meant to be a standalone package, `express` should be listed in `dependencies` or `peerDependencies`.

---

## 6. Summary

### Strengths
- **Clean Middleware Structure**: The custom rate limiting middleware in `src/limit.js` is concise, functional, and supported by a passing unit test in `test/limit.test.js`.
- **Modern ES Module Standard**: Codebase consistently utilizes modern ES module imports (`import`/`export`) and Node built-in test runners (`node:test`).

### Key Risks
- **Partner Integration Breakdown**: Severe mismatch across all API parameters (versions `/v1` vs `/v2`, pagination `page` vs `after`, `POST` status `201` vs `202`, and required headers `idempotency-key`). Partners following `docs/api.md` will receive 404s, 400s, or unexpected data payloads.
- **Unauthenticated Access**: Endpoints currently perform no token validation despite documentation explicitly promising `401` enforcement for missing tokens.

### Priority Order
1. **Fix Authentication (Finding #1)**: Add bearer token authentication middleware to enforce security.
2. **Align Endpoint Routes & Documentation (Findings #2, #3, #4)**: Resolve discrepancies between `/v1` vs `/v2`, pagination (`?page` vs `?after`), and `POST` response contract (`201` vs `202` + `idempotency-key`).
3. **Align Rate Limiting Mechanism (Finding #5)**: Update rate limiting to track per-token limits and set capacity to 100 req/min.
4. **Expand Test Coverage (Finding #6)**: Create API integration tests in `test/` to prevent future contract regressions.

### Coverage Gaps
- **Production Server & Gateway Setup**: Unable to inspect reverse proxies (e.g. NGINX, Cloudflare) or API gateways that might handle authentication or route rewriting before reaching `src/api.js`.
- **Performance & Load Testing**: No load or concurrency benchmarks were executed for rate limiting under high parallelism.
