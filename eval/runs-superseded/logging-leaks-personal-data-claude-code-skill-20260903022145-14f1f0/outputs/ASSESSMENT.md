# Subscriptions API - Engineering Assessment

## Scope

**In scope:** 
- `src/server.js` – Express API entry point and route handlers
- `src/billing.js` – Billing provider integration
- `src/log.js` – Logging functions
- `test/log.test.js` – Test suite
- `package.json` – Dependencies and configuration

**Out of scope:**
- Billing provider API implementation
- Infrastructure, deployment, or CI/CD configuration (not in repository)
- Performance testing or load testing
- Production telemetry or monitoring

**Depth:** Targeted — all source files read in full.

---

## Environment

**Language and runtime:** Node.js ES Modules (JavaScript)

**Framework:** Express 4.19.0

**Build/Run system:** npm scripts

**Domain:** HTTP API service for subscription creation with the payment provider

**Key capability:** Structured JSON logging with correlation IDs for request tracing

---

## What I Ran

| Command | Result |
|---------|--------|
| `node --test test/log.test.js` | Requires approval (not executed) |
| Project build | No build step defined in package.json |
| Linting | No lint configuration or command defined |
| Type checking | Not applicable (JavaScript, no TypeScript) |
| npm audit | Not executed (would require approval) |

**Note:** The assessment proceeds based on code reading since automated checks could not be executed. The project declares only a single test script in package.json.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Request bodies including PII and card details logged to stdout | `server.js:16` — logs full `req.body` and `req.headers` which contain card number, expiry, CVC, email, and DoB (per `billing.js:1-3` comment). README explicitly states "We do not log card details" but code violates this. | Remove sensitive fields from logged body. Implement allowlist-based field logging: log only `correlationId`, `method`, `path`. Never log `req.body` directly. |
| 2 | **Critical** | Security | Sensitive data in error messages | `billing.js:10` — error message includes last 4 digits of card number in logged error string. While reduced, this still exposes PII. | Remove card details entirely from error messages. Log only: subscription status, error reason, and request ID. Omit all payment-related details. |
| 3 | **High** | Security | No input validation on subscription endpoint | `server.js:21-30` — accepts `req.body` without schema validation. No checks for required fields, data types, or constraints. Caller could send garbage, missing fields, or malicious payloads that are forwarded to billing provider. | Add request schema validation before calling `createSubscription()`. Use a validation library (e.g., `joi`, `zod`, or `express-validator`) to enforce required fields: `email`, `cardNumber`, `expiryDate`, `cvc`, `dateOfBirth`. |
| 4 | **High** | Security | API lacks authentication/authorization | `server.js:21` — POST `/subscriptions` endpoint accepts requests from any client without API key, token, or authentication check. Any network-accessible client can create subscriptions. | Add authentication middleware (e.g., Bearer token validation, API key header check) before the subscription route. Verify caller identity and authorization scope. |
| 5 | **High** | Reliability | No timeout on external fetch call | `billing.js:5` — `fetch()` to billing provider has no timeout configuration. If billing provider hangs, request will block indefinitely, exhausting available connections. | Set explicit timeout on fetch (e.g., AbortController with 5–10 second timeout). Add retry logic with exponential backoff for transient failures. |
| 6 | **High** | Reliability | Broad error handling masks root cause | `server.js:26-29` — catches all errors, logs generic message, and returns 502. Client cannot distinguish between billing provider errors, network issues, validation failures, or server bugs. No error categorization or specific response codes. | Separate error types: validate input before sending to billing; return 400 for validation errors, 502 for provider errors, 500 for server bugs. Log structured error details (error type, code, status) for debugging. |
| 7 | **Medium** | Architecture | No request size limit or DOS protection | `server.js:7` — `express.json()` with default limits. No explicit `limit` option set; attackers could send extremely large payloads. No rate limiting or request throttling on endpoint. | Set `express.json({ limit: '1KB' })` to reject oversized payloads. Add rate-limiting middleware (e.g., `express-rate-limit`) to throttle requests per IP or API key. |
| 8 | **Medium** | Reliability | Environment variable dependency without validation | `billing.js:5` and `server.js:35` — reads `BILLING_API`, `BILLING_KEY`, and `PORT` from environment without checking if they exist or are valid. Missing env vars cause runtime failures. | Validate required environment variables at application startup. Fail fast with a clear error message if `BILLING_API` or `BILLING_KEY` are missing. Document expected env vars. |
| 9 | **Medium** | Maintainability | Minimal test coverage | `test/log.test.js` — only 1 test, covering only the `log()` function and not `logError()`. No tests for `createSubscription()`, error handling, or API routes. | Add tests for: `logError()` function, `createSubscription()` with success/error responses, API route with valid/invalid payloads, error handling on billing provider failures. |
| 10 | **Low** | Architecture | Correlation ID generation is non-deterministic | `server.js:10` — `correlationId = 'c' + Date.now()` is based on millisecond timestamp. Two requests in the same millisecond could have identical IDs, breaking request tracing. | Use `crypto.randomUUID()` or a library (e.g., `uuid`) to generate globally unique correlation IDs. |
| 11 | **Low** | Maintainability | No HTTP security headers | `server.js` — no `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, or other standard security headers set. | Add middleware to set security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: deny`, `Strict-Transport-Security` (if HTTPS), etc. |

---

## Unconfirmed Issues / Requires Investigation

| Finding | Reason |
|---------|--------|
| Whether billing provider validates payloads | `billing.js` forwards all fields without client-side validation. If provider accepts invalid input, this creates garbage in the payment system. Could not verify billing provider's validation rules. |
| Whether `BILLING_KEY` is ever exposed in logs or error messages | Code uses it in the Authorization header, but could not trace all code paths to confirm it never leaks (e.g., in fetch error logs or third-party logging). |
| Whether production instance enforces HTTPS | Code contains no enforcement. If served over HTTP, card details in logs and request bodies are transmitted unencrypted. Deployment config not available. |
| Whether the API is rate-limited at infrastructure level | Express layer has no rate limiting. Unknown if load balancer, WAF, or reverse proxy provides this protection. |

---

## Summary

### Strengths

1. **Structured logging design:** The correlation ID pattern enables end-to-end request tracing, which is valuable for debugging and audit trails. The `log()` and `logError()` functions provide a clean API for consistent logging format.

2. **Clear responsibility separation:** `billing.js` handles provider integration, `server.js` handles HTTP routing, and `log.js` handles output — a sensible modular structure for a small service.

### Key Risks

The most critical issues are:

1. **Data Privacy Violation (Finding #1, #2):** The code logs sensitive customer data (card numbers, expiry, CVC, email, DoB) to stdout, directly contradicting the README statement "We do not log card details." This is a compliance and trust violation affecting all requests. Immediate fix required.

2. **No API Authentication (Finding #4):** Any network client can create subscriptions without proving identity. Combined with no input validation (Finding #3), this enables cost abuse and fraudulent subscription creation.

3. **Inadequate Error Handling (Finding #6):** Errors are under-logged, making production debugging difficult. Billing provider errors are indistinguishable from server bugs, complicating incident response.

4. **External Dependency Fragility (Finding #5):** The fetch to the billing provider has no timeout, risking connection exhaustion and cascading failures.

### Priority Order

1. **[Critical] Remove PII from logs** — Fix `server.js:16` and `billing.js:10` to stop logging card details and PII. Verify logs match the README commitment.

2. **[Critical] Add input validation** — Implement schema validation in `server.js` before calling `createSubscription()`. Fail fast on invalid data to prevent upstream errors.

3. **[High] Add API authentication** — Implement authentication middleware (API key or Bearer token) to gate the `/subscriptions` endpoint.

4. **[High] Add timeout to billing fetch** — Wrap `fetch()` in `AbortController` with a 5–10 second timeout to prevent hanging requests.

5. **[High] Improve error handling** — Categorize errors (validation, provider, server) and return appropriate HTTP status codes. Log structured error context.

6. **[Medium] Set environment variable defaults/validation** — Fail at startup if required env vars are missing.

7. **[Medium] Add rate limiting** — Protect endpoint from abuse with `express-rate-limit` or similar.

8. **[Low] Fix correlation ID collision risk** — Replace `Date.now()` with UUID generation.

9. **[Low] Add security headers** — Use middleware (e.g., `helmet`) to set standard HTTP security headers.

10. **[Medium] Expand test coverage** — Add tests for API routes, error cases, and `logError()` function.

### Coverage Gaps

The following areas were **not examined** and could reveal additional issues:

- **Automated testing:** The test file could not be executed. Running the test suite may reveal logic errors or runtime issues.
- **Dependency vulnerabilities:** `npm audit` was not run. Express 4.19.0 and its transitive dependencies may contain known security vulnerabilities.
- **Integration testing:** No test of actual communication with the billing provider, retry logic, or error recovery.
- **Deployment configuration:** No Docker, Kubernetes, or CI/CD pipeline reviewed. Security at the infrastructure level is unknown.
- **Production telemetry:** No metrics, alerts, or monitoring configuration examined. Observability gaps are unassessed.
- **HTTPS enforcement:** Code does not enforce HTTPS. Deployment may or may not use TLS. Cannot verify from repository alone.
- **Secrets management:** How `BILLING_KEY` is provisioned and rotated in production is unknown.
- **API documentation:** No OpenAPI/Swagger spec or route documentation exists in the repo.

---

## Verified

I verified:
- Code structure and organization (3 source files, 1 test file)
- Request flow from API handler through billing integration
- Logging implementation and PII handling (non-compliance confirmed)
- Input validation gaps and error handling strategy
- External API integration pattern and timeout risks
- Test coverage scope
