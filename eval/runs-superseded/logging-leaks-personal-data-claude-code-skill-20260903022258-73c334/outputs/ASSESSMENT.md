# Subscriptions API - Engineering Assessment

## Scope

**In scope:**
- `src/server.js` — Express server and request handling
- `src/billing.js` — Payment provider integration
- `src/log.js` — Structured logging implementation
- `test/log.test.js` — Existing test suite
- `package.json` — Dependency declarations

**Out of scope:**
- External billing API implementation (not in repo)
- Production deployment configuration
- Load testing or performance benchmarking
- Integration with external services beyond code inspection

**Depth:** Targeted (all in-scope files read in full)

---

## Environment

**Language & Runtime:** Node.js (v24.14.1), JavaScript (ES modules)

**Framework:** Express.js 4.19.0

**Domain:** RESTful API for creating payment subscriptions

**Platform:** Server-side Node.js application

**Build/Test Tools:** Node.js built-in `node --test`, npm

---

## What I Ran

| Check | Command | Result |
|-------|---------|--------|
| Node version | `node --version` | v24.14.1 ✓ |
| npm test | Requires approval; not executed | Skipped |
| npm audit | Requires approval; not executed | Skipped |
| Type checking | `tsc --noEmit` | Not installed; ESM only, no TypeScript |
| Linting | `eslint .` | Not installed; no linting configured |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Security | Card number and PII logged in request middleware | `src/server.js:11-17` — logs full `req.body` containing card number, expiry, CVC, and date of birth | Remove sensitive fields from logs. Log only safe identifiers (customer ID, subscription ID). Implement separate log filter for PII data. |
| 2 | Critical | Security | Card details exposed in error messages | `src/billing.js:10` — error message includes last 4 digits of card number; this gets logged via `logError` and ships to central log store | Remove card number from error message. Use generic identifier or customer ID only. Error should never contain card data. |
| 3 | High | Reliability | No request validation before upstream call | `src/server.js:21-29` — POST body is passed directly to `createSubscription` without checking required fields (email, cardNumber, expiry, cvc, dateOfBirth) | Validate payload schema before calling billing API. Return 400 on validation failure with specific field errors. |
| 4 | High | Reliability | No timeout on upstream API calls | `src/billing.js:5-9` — `fetch()` has no timeout; request could hang indefinitely if billing API is unresponsive | Add fetch timeout (e.g., `AbortSignal.timeout(5000)` for 5s timeout). Return appropriate error to client if timeout occurs. |
| 5 | High | Reliability | No retry logic for transient failures | `src/billing.js:5-9` — single attempt to billing API; transient network issues cause immediate failure to client | Implement exponential backoff retry for 5xx errors (max 3 attempts). Document retry behavior in API contract. |
| 6 | Medium | Architecture | Environment variables not validated at startup | `src/billing.js:5,7` — `BILLING_API` and `BILLING_KEY` read from environment but never checked to exist | Add validation function on server startup to ensure all required env vars are set. Exit early with clear error if missing. |
| 7 | Medium | Maintainability | No tests for server or billing modules | `test/` — only `log.test.js` exists; core endpoint and billing integration have zero test coverage | Add test suite covering: valid subscription creation, missing fields, billing API errors, timeout behavior, error logging. |
| 8 | Medium | Reliability | Generic error response hides debugging information | `src/server.js:28` — returns generic `{ error: 'could not create subscription' }` with 502 status; client cannot distinguish auth failure, timeout, or invalid data | Return structured error with error code (e.g., `{ error: 'billing_service_unavailable', code: 'BILLING_API_ERROR' }`). Document error codes in API docs. |
| 9 | Low | Code Quality | Middleware logs full request headers | `src/server.js:16` — logs `req.headers` which may contain sensitive auth tokens or cookies from client | Filter headers in logs to exclude `authorization`, `cookie`, `x-api-key`, etc. Log only relevant headers (e.g., `user-agent`). |

---

## Unconfirmed Issues / Requires Investigation

| Issue | Evidence Gap | Investigation Needed |
|-------|--------------|----------------------|
| Correlation ID collision | `src/server.js:10` — uses `Date.now()` for correlation ID; high concurrency could cause collisions | Run concurrent load test; verify uniqueness under high request volume |
| Express dependency vulnerabilities | `package.json` — express 4.19.0 is recent but no audit output | Run `npm audit` to check for known CVEs in express and transitive deps |
| HTTPS enforcement | No evidence of HTTPS or redirect-to-HTTPS in code | Verify in deployment config / reverse proxy that production enforces TLS |
| CORS configuration | `src/server.js` — no CORS middleware; unclear if intentional | Verify API contract: is this public, internal, or cross-origin restricted? |

---

## Summary

### Strengths

1. **Structured logging design** — Correlation ID on every log line enables end-to-end request tracing. JSON format is machine-parseable and appropriate for a central log store. `src/log.js` is clean and single-purpose.

2. **Error handling pathway exists** — Errors from the billing API are caught (line 26), logged with context, and return a 5xx response. No unhandled rejections visible.

3. **ES modules and modern Node.js** — Uses native ES modules and modern async/await patterns. No legacy callback hell or deprecated Node APIs.

### Key Risks

**Data Exposure (Findings #1 #2):** The most critical issue is logging of payment card data. Full card details are logged in the request middleware, and card digits leak into error messages. These logs ship to a central store retained for 2 years. This violates PCI-DSS requirements and exposes customer data. **This must be fixed immediately.**

**Reliability Gaps (Findings #3 #4 #5):** The API has no input validation, timeout protection, or retry logic for the upstream billing service. Any disruption in the billing API will cascade to clients. Request validation should catch malformed inputs before they reach the external API.

**Observability Deficit (Finding #8):** Error responses are generic, making debugging and monitoring difficult. Structured error codes would help both client applications and support teams.

### Priority Order

1. **CRITICAL — Remove card data from logs** (Findings #1, #2)
   - Remove `body` field from request log
   - Filter `req.headers` to exclude auth tokens
   - Remove card number from billing error message
   - **Effort:** ~30 minutes | **Impact:** Compliance + security

2. **CRITICAL — Add request validation** (Finding #3)
   - Schema validation for required fields before calling billing API
   - Return 400 Bad Request with field-level errors
   - **Effort:** ~1 hour | **Impact:** Prevents downstream errors

3. **HIGH — Add fetch timeout** (Finding #4)
   - Set 5–10s timeout on billing API calls
   - Return 503 Service Unavailable on timeout
   - **Effort:** ~15 minutes | **Impact:** Prevents request hangs

4. **HIGH — Add retry logic** (Finding #5)
   - Exponential backoff for transient errors (5xx)
   - Max 3 attempts with jitter
   - **Effort:** ~1 hour | **Impact:** Improves resilience

5. **MEDIUM — Validate environment setup** (Finding #6)
   - Check `BILLING_API` and `BILLING_KEY` on startup
   - Exit with clear error if missing
   - **Effort:** ~15 minutes | **Impact:** Fail fast on misconfiguration

6. **MEDIUM — Structured error responses** (Finding #8)
   - Add error codes to response: `{ error: 'billing_service_unavailable', code: 'BILLING_TIMEOUT' }`
   - Document error codes in API spec
   - **Effort:** ~45 minutes | **Impact:** Better debugging + monitoring

7. **MEDIUM — Add test suite** (Finding #7)
   - Test valid requests, missing fields, billing errors, timeouts
   - Achieve 80%+ coverage on server.js and billing.js
   - **Effort:** ~3–4 hours | **Impact:** Prevent regressions

### Coverage Gaps

- **Automated tests:** Only 1 test exists (log module). No tests for server endpoints or billing integration. Test suite was not run due to permission requirement.
- **Linting & formatting:** No eslint or Prettier configuration. Code style is not enforced.
- **Type safety:** No TypeScript or JSDoc types. Runtime type checking is not available.
- **Dependency vulnerabilities:** `npm audit` was not run due to permission requirement. Current state of transitive dependencies is unknown.
- **Deployment & operations:** No Docker config, no CI/CD pipeline, no environment variable documentation visible. Production configuration is out of scope.
- **Load testing:** No information on expected request volume, response time SLAs, or behavior under sustained load.
- **HTTPS/TLS:** No evidence of SSL/TLS enforcement at the application level (may be handled by reverse proxy).
- **Rate limiting & DDoS protection:** Not implemented in code; may be delegated to infrastructure.
- **CORS:** No CORS headers configured; API cross-origin policy is undocumented.

---

## Verified

✓ Examined all 3 source files and 1 test file (100% of codebase by file count)
✓ Identified 9 confirmed findings with specific evidence (file:line)
✓ Node.js environment verified (v24.14.1)
✓ Listed unavailable checks (npm audit, npm test, linting, type checking)
✓ Confirmed PII exposure risk in logs and error messages
✓ Confirmed absence of input validation and timeout handling
✓ Confirmed test coverage gap (1 test for 3 modules)
