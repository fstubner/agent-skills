# Engineering Assessment: Events API & Documentation Audit

## Scope

- **In Scope**:
  - `README.md`
  - `docs/api.md`
  - `package.json`
  - `src/api.js`
  - `src/limit.js`
  - `test/limit.test.js`
- **Out of Scope**:
  - Live production deployment environments and external persistence layers (not present in repo).
- **Audit Depth**: `deep` — Every file in the repository was read in full, and all project test commands were executed and verified.

---

## Environment

- **Runtime & Language**: Node.js (ES Modules, `"type": "module"`)
- **Frameworks & Libraries**: Express (consumed via `createApp(express)` entrypoint)
- **Test Runner**: Node native test runner (`node --test`)
- **Tooling Overlays**: None configured

---

## Tooling Results

### Executed Commands

#### `npm test`
```
> test
> node --test test/limit.test.js

✔ requests under the limit pass through (0.8919ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 133.4414
```

- **Tools Run Successfully**: `npm test` (1 passed, 0 failed).
- **Tools Unavailable / Not Configured**: No linter (`eslint`), type checker (`tsc`), build script (`npm run build`), or security auditor (`npm audit` lockfile missing) configured in `package.json`.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | **Critical** | Security | Missing Authentication Enforcement | `docs/api.md:5-6` vs `src/api.js:5-23` | Implement authentication middleware in `src/api.js` to validate `Authorization: Bearer <token>` and return `401` on invalid/missing tokens. |
| 2 | **High** | API Contract | Endpoint Version Mismatch (`/v1` vs `/v2`) | `docs/api.md:8,12` vs `src/api.js:11,17` | Reconcile endpoint paths: either support `/v1/events` for backwards compatibility or update `docs/api.md` to reflect `/v2/events`. |
| 3 | **High** | API Contract | `POST /events` Undocumented Header & Status Code | `docs/api.md:14` vs `src/api.js:17-20` | `src/api.js` mandates an undocumented `idempotency-key` header (returns `400` if missing) and returns `202` instead of `201`. Reconcile docs and implementation. |
| 4 | **High** | API Contract | `GET /events` Pagination Mechanism Mismatch | `docs/api.md:10` vs `src/api.js:3,10-15` | `docs/api.md` specifies page-offset pagination (`?page=2`, limit 50). `src/api.js` implements cursor pagination (`?after=<id>`, limit 25). Align documentation with runtime behavior. |
| 5 | **High** | Security / Reliability | Rate Limit Keying and Threshold Mismatch | `docs/api.md:18` vs `src/api.js:8` & `src/limit.js:4` | `docs/api.md` specifies 100 req/min per token. `src/api.js` sets 600 req/min, and `src/limit.js` keys by IP address (`req.ip`), throttling shared partner IPs. Key by token and enforce intended rate. |
| 6 | **Medium** | Test Coverage | Missing API Route & Integration Tests | `package.json:5` & `test/limit.test.js:1-14` vs `src/api.js:1-28` | `npm test` only tests `rateLimit` unit logic. Add comprehensive route tests for `src/api.js` covering auth, status codes, required headers, and pagination. |

---

## Unconfirmed Issues

1. **`loadEvents` Persistence Integration**: `src/api.js:25-27` contains a mock `loadEvents` function returning `[]`. Production integration with a real database may introduce additional filtering, sorting, or pagination constraints.

---

## Summary

### Strengths
1. **Clean In-Memory Rate Limiting Logic**: `src/limit.js` correctly tracks sliding window timestamps per key without leaking memory across standard windows.
2. **Standard Express App Factory**: `src/api.js` uses an explicit dependency-injection pattern (`createApp(express)`), making unit testing and app instantiation straightforward.

### Key Risks
1. **Total Breakdown of Partner Contract**: Every single API aspect in `docs/api.md` (version path, authentication, pagination parameters, post response codes, rate limit keying & limits) directly contradicts `src/api.js` (Findings 1, 2, 3, 4, 5).
2. **Undocumented 400 Bad Request Errors**: Partners attempting `POST /v1/events` face immediate 404s; if calling `POST /v2/events`, they receive undocumented 400 errors due to missing `idempotency-key` header (Finding 3).
3. **No Unauthenticated Request Blocking**: Security risk as endpoints execute without checking bearer tokens (Finding 1).

### Priority Order
1. **Fix Authentication Enforcement (Finding 1)**: Implement token verification middleware to protect endpoints.
2. **Reconcile API Routing & Contracts (Findings 2, 3, 4)**: Align versions (`/v1` vs `/v2`), headers (`idempotency-key`), status codes (`201` vs `202`), and pagination (`page` vs `cursor`).
3. **Correct Rate Limiter Keying & Limits (Finding 5)**: Key rate limiting on token identity rather than client IP address.
4. **Expand Test Coverage (Finding 6)**: Add suite of route-level tests in `test/` to prevent contract regression.

### Coverage Gaps
- **Persistence Layer**: `loadEvents` data fetching logic is unexamined as it is currently stubbed.
- **Production Infrastructure**: Reverse proxies, API gateways, load balancers, or outer rate limiters fronting `src/api.js` were not examined.
