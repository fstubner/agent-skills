# Engineering Assessment: Events API & Documentation Audit

## 1. Scope

- **In Scope**: All repository contents:
  - Documentation: `docs/api.md`, `README.md`
  - Core implementation: `src/api.js`, `src/limit.js`
  - Configuration & Tests: `package.json`, `test/limit.test.js`
- **Out of Scope**: External consumers / partners, deployment/infrastructure setups not contained in repository.
- **Audit Depth**: `deep` — Every file in the repository was examined in full, and repository test tooling was executed and recorded.

---

## 2. Environment

- **Runtime & Language**: Node.js (ES Module format (`"type": "module"` in `package.json`))
- **Frameworks**: Express (consumed via `createApp(express)` in `src/api.js`)
- **Test Runner**: Node native test runner (`node --test test/limit.test.js`)
- **Tooling**: npm

---

## 3. Tooling Results / What I Ran

The project's test command declared in `package.json` was executed:

```console
$ npm test

> test
> node --test test/limit.test.js

✔ requests under the limit pass through (0.8614ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 150.9957
```

**Outcome**: Pass (1 test, 0 failures).

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | **High** | Correctness | **API Version & Endpoint Paths Mismatch**: Docs detail `/v1/events` endpoints, but code implements `/v2/events`. | [`docs/api.md:8,12`](file:///C:/tmp/agent-skills-eval-MPt4N1/workspace/docs/api.md#L8-L12) vs [`src/api.js:11,17`](file:///C:/tmp/agent-skills-eval-MPt4N1/workspace/src/api.js#L11-L17) | Update `docs/api.md` to document `/v2/events` or implement `/v1/events` endpoints. |
| 2 | **High** | Security / Auth | **Missing Authentication Enforcement**: Docs state every endpoint requires a bearer token and returns `401` without one; code contains no auth middleware or checks. | [`docs/api.md:5-6`](file:///C:/tmp/agent-skills-eval-MPt4N1/workspace/docs/api.md#L5-L6) vs [`src/api.js:5-23`](file:///C:/tmp/agent-skills-eval-MPt4N1/workspace/src/api.js#L5-L23) | Add bearer token authentication middleware to `src/api.js` (or document if auth is handled by an upstream gateway). |
| 3 | **High** | Correctness | **GET Pagination & Schema Mismatch**: Docs claim 50 events/page with page-number pagination (`?page=2`); code uses cursor-based pagination (`?after=<id>`), 25 events/page, returning `{ events: [...], nextCursor: ... }`. | [`docs/api.md:10`](file:///C:/tmp/agent-skills-eval-MPt4N1/workspace/docs/api.md#L10) vs [`src/api.js:3,11-15`](file:///C:/tmp/agent-skills-eval-MPt4N1/workspace/src/api.js#L3-L15) | Update `docs/api.md` to detail `?after` cursor parameter, 25 item limit, and response object structure. |
| 4 | **High** | Correctness | **POST Headers, Status Code & Response Mismatch**: Docs state POST returns `201` with created event body; code requires `idempotency-key` header (returns `400` if missing) and returns `202 Accepted` with `{ accepted: true }`. | [`docs/api.md:14`](file:///C:/tmp/agent-skills-eval-MPt4N1/workspace/docs/api.md#L14) vs [`src/api.js:17-20`](file:///C:/tmp/agent-skills-eval-MPt4N1/workspace/src/api.js#L17-L20) | Document mandatory `idempotency-key` header, `400` validation response, `202 Accepted` status, and `{ accepted: true }` body. |
| 5 | **Medium** | Reliability | **Rate Limiting Threshold & Key Mismatch**: Docs state limit is 100 requests/min per token; code enforces 600 requests/min and keys by client IP address (`req.ip`). | [`docs/api.md:18`](file:///C:/tmp/agent-skills-eval-MPt4N1/workspace/docs/api.md#L18) vs [`src/api.js:8`](file:///C:/tmp/agent-skills-eval-MPt4N1/workspace/src/api.js:8) & [`src/limit.js:4`](file:///C:/tmp/agent-skills-eval-MPt4N1/workspace/src/limit.js#L4) | Update rate limiting key extractor to use token (or update docs to specify IP) and align max request count. |
| 6 | **Low** | Maintainability | **Missing Integration Test Coverage**: Tests only cover isolated unit test for `rateLimit` middleware; no tests exist for `src/api.js` endpoints. | [`test/limit.test.js:1-14`](file:///C:/tmp/agent-skills-eval-MPt4N1/workspace/test/limit.test.js#L1-L14) vs [`src/api.js:5-23`](file:///C:/tmp/agent-skills-eval-MPt4N1/workspace/src/api.js#L5-L23) | Add supertest/HTTP integration tests for `GET /v2/events` and `POST /v2/events` routes. |

---

## 5. Unconfirmed Issues

- **Upstream Authentication / Gateway Handling**: It is possible that bearer token authentication is performed upstream (e.g. by an API gateway or reverse proxy) prior to reaching Express app. However, within this codebase repository, no authentication code exists.

---

## 6. Summary

### Strengths
1. Clean, modular code structure separating rate-limiting middleware (`src/limit.js`) from API route definitions (`src/api.js`).
2. Core rate limiter has a functional unit test (`test/limit.test.js`) that passes cleanly.

### Key Risks
- **Partner Integration Breakdown**: Virtually every single contract documented in `docs/api.md` (route version, authentication requirements, query params, request headers, HTTP status codes, payload structures, and rate limits) is contradicted by `src/api.js`. Partners using `docs/api.md` will experience `404 Not Found` (hitting `/v1/`), `400 Bad Request` (missing `idempotency-key`), unexpected status codes (`202` vs `201`), and schema parse errors.

### Priority Order
1. Align documentation (`docs/api.md`) or code paths for `/v2/events` vs `/v1/events` and payload schemas (Findings 1, 3, 4).
2. Clarify and implement authentication requirement or update documentation if handled upstream (Finding 2).
3. Align rate limit configuration and key extraction strategy (Finding 5).
4. Add route-level integration tests to prevent contract regressions (Finding 6).

### Coverage Gaps
- **Production Infrastructure / Gateway Config**: Proxy, gateway, or ingress configuration (where auth header checks or rate-limiting might be duplicated) was unavailable for inspection in this repository.
