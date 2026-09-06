# Engineering Assessment: Events API Documentation & Implementation Alignment

## 1. Scope

- **In Scope**:
  - `docs/api.md`: Public API documentation provided to partners.
  - `src/api.js`: Express application definition and route handlers.
  - `src/limit.js`: Rate limiting middleware implementation.
  - `test/limit.test.js`: Automated test suite for rate limiting.
  - `package.json`: Project scripts and dependencies.
  - `README.md`: Repository documentation overview.
- **Out of Scope**:
  - Production database integration (`loadEvents` internal logic).
  - External API gateways, proxy routing, or deployment infrastructure.
- **Depth**: `deep`
  - Every file in the repository was read in full.
  - Automated project test commands were executed and results recorded.

---

## 2. Environment

- **Languages & Runtimes**: JavaScript (Node.js `v24.14.1`, ECMAScript Modules).
- **Frameworks & Libraries**: Express.js (injected via `createApp(express)`).
- **Domain**: Event ingestion public API.
- **Build & Test Tooling**: Node.js native test runner (`node --test`), npm.

---

## 3. Tooling Results (What I Ran)

The following commands were executed in the repository root:

### Command 1: `node -v`
- **Exit Code**: `0`
- **Output**:
  ```
  v24.14.1
  ```

### Command 2: `npm test`
- **Exit Code**: `0`
- **Output**:
  ```
  > test
  > node --test test/limit.test.js

  ✔ requests under the limit pass through (1.061ms)
  ℹ tests 1
  ℹ suites 0
  ℹ pass 1
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 125.1181
  ```

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | **Critical** | Security | Documented Bearer token authentication is missing in implementation | [`docs/api.md:5-6`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/docs/api.md#L5-L6) claims requests require `Authorization` header or receive `401`. [`src/api.js:5-23`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/src/api.js#L5-L23) has no authentication middleware or token check. | Implement Bearer token verification middleware on `/v2/events` or update documentation to match actual auth requirements. |
| 2 | **High** | Correctness | Endpoint version / path mismatch (`/v1/events` vs `/v2/events`) | [`docs/api.md:8,12`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/docs/api.md#L8-L12) documents `GET /v1/events` and `POST /v1/events`. [`src/api.js:11,17`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/src/api.js#L11-L17) registers `/v2/events`. | Align versioning in `docs/api.md` to `/v2/events` or add `/v1` backward-compatibility routes. |
| 3 | **High** | Correctness | GET pagination parameters, page size, and response shape mismatch | [`docs/api.md:10`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/docs/api.md#L10) specifies offset pagination (`?page=2`) with 50 items/page. [`src/api.js:3,10-15`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/src/api.js#L3-L10-L15) implements cursor pagination (`?after=<id>`), page size 25 (`PAGE_SIZE = 25`), and returns `{ events, nextCursor }`. | Update `docs/api.md` to document cursor pagination (`?after`), default limit of 25, and response structure `{ events, nextCursor }`. |
| 4 | **High** | Correctness | POST response HTTP status code and response body mismatch | [`docs/api.md:14`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/docs/api.md#L14) claims POST returns HTTP `201` with created event body. [`src/api.js:19`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/src/api.js#L19) returns HTTP `202` with `{ accepted: true }`. | Align documentation and API implementation on `202 Accepted` status code and `{ accepted: true }` body. |
| 5 | **High** | Correctness | Undocumented required `idempotency-key` header | [`src/api.js:18`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/src/api.js#L18) rejects POST requests without an `idempotency-key` header with HTTP `400`. [`docs/api.md:12-15`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/docs/api.md#L12-L15) makes no mention of this required header. | Add `idempotency-key` header requirements and 400 error behavior to `docs/api.md`. |
| 6 | **Medium** | Maintainability | Rate limiting threshold and tracking key mismatch | [`docs/api.md:18`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/docs/api.md#L18) states 100 req/min per token. [`src/api.js:8`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/src/api.js#L8) configures `max: 600` (600 req/min), and [`src/limit.js:4`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/src/limit.js#L4) tracks by IP (`req.ip`) instead of token. | Align rate limit settings (100 vs 600 req/min) and rate-limit tracking key (IP vs Bearer Token) across docs and code. |
| 7 | **Medium** | Reliability | Absence of API route integration tests | [`test/limit.test.js:1-14`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/test/limit.test.js#L1-L14) only tests `rateLimit` middleware unit logic. `src/api.js` route handlers have zero automated test coverage. | Add integration tests for Express routes in `src/api.js` to automatically verify contract enforcement (status codes, headers, pagination, auth). |

---

## 5. Unconfirmed Issues

- **Database / Event Store Backend**: `loadEvents` in [`src/api.js:25-27`](file:///C:/tmp/agent-skills-eval-FYyaO6/workspace/src/api.js#L25-L27) is an inline stub returning `[]`. Full query behavior and persistence error handling cannot be confirmed without the real data source implementation.

---

## 6. Summary

### Strengths
- **Modular Express App Architecture**: `createApp(express)` in `src/api.js` uses a clean dependency injection pattern, making it straightforward to mount and test.
- **Isolated Rate Limiting Unit Test**: `src/limit.js` is clean, modular middleware and is verified by a passing unit test in `test/limit.test.js`.

### Key Risks
- **Partner Integration Breakdown**: `docs/api.md` diverges from `src/api.js` across every documented detail—URL version path (`/v1` vs `/v2`), authentication requirement (documented vs un-enforced), pagination parameters (`?page` vs `?after`), POST status code (`201` vs `202`), POST required headers (`idempotency-key`), and rate limit thresholds (100/min per token vs 600/min per IP).

### Priority Order
1. **Fix Authentication Gap** (Finding #1): Address security discrepancy between documented Bearer token auth requirement and missing code enforcement.
2. **Align Documentation & Endpoint Specifications** (Findings #2, #3, #4, #5): Update `docs/api.md` (or update route handlers) so that path versions (`/v2/events`), pagination (`?after`), status codes (`202`), and mandatory headers (`idempotency-key`) match actual runtime contracts.
3. **Harmonize Rate Limiting Policy** (Finding #6): Reconcile rate limit quota (100 vs 600) and keying mechanism (IP vs Auth token).
4. **Expand Test Coverage** (Finding #7): Add integration tests for Express endpoints to prevent future documentation and implementation drift.

### Coverage Gaps
- Real event ingestion and data storage backend (stubbed in `loadEvents`).
- Production reverse proxy / API Gateway configuration (e.g. Nginx, Cloudflare, AWS API Gateway) which may handle token auth or rate limiting upstream.
