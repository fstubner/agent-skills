# Engineering Assessment: Events API Documentation & Implementation Audit

## 1. Scope

- **In scope**: All files in the repository:
  - Documentation: [`docs/api.md`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/docs/api.md)
  - Source Code: [`src/api.js`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/src/api.js), [`src/limit.js`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/src/limit.js)
  - Tests & Tooling: [`test/limit.test.js`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/test/limit.test.js), [`package.json`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/package.json), [`README.md`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/README.md)
- **Out of scope**: External API gateways, infrastructure/deployment manifests, production database connections.
- **Depth**: `targeted` — every file in the repository was read in full and analyzed against the API contract.

---

## 2. Environment

- **Languages & Runtimes**: JavaScript (Node.js ES Modules, `node:test`)
- **Frameworks**: Express.js syntax (`createApp(express)`)
- **Domain**: Partner Event Ingestion Public API
- **Build Systems & Tooling**: Node.js built-in test runner (`node --test`)

---

## 3. Tooling Results

### What I ran

| Command | Status | Output Summary |
|---------|--------|----------------|
| `npm test` | Passed (Exit 0) | `node --test test/limit.test.js`<br>✔ requests under the limit pass through (1.4ms)<br>1 pass, 0 fail, duration 282ms |

#### Executed Command Log
```text
> npm test
> node --test test/limit.test.js

✔ requests under the limit pass through (1.4334ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 282.627
```

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | **Critical** | Security | Unauthenticated API Endpoints | [`src/api.js:5-23`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/src/api.js#L5-L23) has no authentication middleware, whereas [`docs/api.md:5-6`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/docs/api.md#L5-L6) states requests require a Bearer token and return 401 if missing. | Implement Bearer token verification middleware in `createApp` or align docs if authentication is offloaded. |
| 2 | **High** | Functionality | API Version Mismatch | [`src/api.js:11,17`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/src/api.js#L11) implements `/v2/events`, but [`docs/api.md:8,12`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/docs/api.md#L8) documents `/v1/events`. Partners calling `/v1/events` get 404 responses. | Update docs to `/v2/events` or add backwards-compatible routing for `/v1/events`. |
| 3 | **High** | Functionality | GET Pagination Mechanism & Limit Mismatch | [`src/api.js:3,11-15`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/src/api.js#L3) uses cursor pagination (`?after=<id>`, 25 items/page returning `nextCursor`), whereas [`docs/api.md:10`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/docs/api.md#L10) documents page-number pagination (`?page=2`, 50 items/page). | Update documentation to accurately describe cursor pagination and the 25 item limit. |
| 4 | **High** | Functionality | POST Request Contract Mismatch | [`src/api.js:17-20`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/src/api.js#L17-L20) requires `idempotency-key` header (returns 400 if missing) and returns `202 Accepted` (`{ accepted: true }`), whereas [`docs/api.md:12-14`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/docs/api.md#L12-L14) specifies `201 Created` with created body and no header requirement. | Align `POST` documentation with required headers, 202 status code, and payload structure. |
| 5 | **Medium** | Correctness | Rate Limiter Configuration & Strategy Mismatch | [`src/api.js:8`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/src/api.js#L8) sets max requests to 600/min and [`src/limit.js:4`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/src/limit.js#L4) keys rate limits by IP address (`req.ip`), whereas [`docs/api.md:18`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/docs/api.md#L18) documents 100 requests per minute per token. | Update rate limit middleware to key by token if auth is used, and align limits between code and docs. |
| 6 | **Medium** | Maintainability | Missing Integration Tests for API Endpoints | [`test/limit.test.js:1-14`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/test/limit.test.js#L1-L14) only unit tests `rateLimit`. No test suite tests `createApp` routes or API contracts. | Add integration tests for GET and POST `/v2/events` routes to verify status codes, headers, and responses. |

---

## 5. Unconfirmed Issues

- **Upstream Gateway Authentication**: It is unconfirmed whether authentication and rate-limiting per token are handled by an external API gateway (e.g. Kong, AWS API Gateway) before requests reach this service, as gateway manifests are not present in this workspace.

---

## 6. Summary

### Strengths
1. **Clean Code Structure**: Source files are modular and easy to read (`src/api.js` and `src/limit.js`).
2. **Existing Unit Test Base**: The rate limiter has an isolated unit test in [`test/limit.test.js`](file:///C:/tmp/agent-skills-eval-GGgyFu/workspace/test/limit.test.js) using standard Node.js test primitives.

### Key Risks
- **Partner Integration Breakage**: Major contract mismatches across versioning (v1 vs v2), pagination parameters (`?page=` vs `?after=`), undocumented required headers (`idempotency-key`), and response status codes (`201` vs `202`) cause partner requests to fail.
- **Security Vulnerability**: Endpoints are unauthenticated in application code despite documentation claiming Bearer token enforcement.

### Priority Order
1. **Fix Endpoint Authentication (Finding #1)**: Verify and enforce Bearer token authentication or document gateway requirements.
2. **Align Endpoint Path & Contract Docs (Findings #2, #3, #4)**: Update `docs/api.md` to reflect `/v2/events`, cursor pagination (`?after`), mandatory `idempotency-key` header, and 202 response format.
3. **Align Rate Limiting Policy (Finding #5)**: Reconcile rate limit rates (100 vs 600) and grouping key (IP vs Token).
4. **Expand Test Coverage (Finding #6)**: Add integration tests for all API endpoints to prevent future doc-code drift.

### Coverage Gaps
- Infrastructure and API Gateway configurations were not examined (outside codebase scope).
- Production request/error logs were not available to measure partner failure rates.
