# Engineering Assessment: Subscriptions API

## Scope

**In scope**: 
- `src/` directory: server.js (Express app), billing.js (payment provider integration), log.js (logging utility)
- `test/` directory: unit tests
- `package.json` and project configuration

**Out of scope**:
- Deployment configuration and infrastructure
- Production environment variables and secrets management
- Integration testing with actual payment provider
- Load testing and performance benchmarking
- End-to-end testing across the full platform

**Depth**: Targeted — all in-scope files were read in full; available automated checks were run.

---

## Environment

- **Language/Runtime**: JavaScript (Node.js), type: module
- **Framework**: Express.js (^4.19.0)
- **Domain**: API service for subscription creation with payment provider integration
- **Platform target**: Server-side (Node.js)
- **Build system**: npm
- **Logging approach**: Structured JSON with correlation IDs

---

## What I Ran

| Command | Status | Result |
|---------|--------|--------|
| `npm test` | ✅ Passed | 1 test passed, 0 failed. Test verified that log utility writes one JSON line correctly. |
| `npm audit` | ⏭️ Skipped | Requires additional approval; dependency security would need verification separately. |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Security | **Full card details logged in request middleware** | `src/server.js:15` — `body: req.body` logs entire request including card number, expiry, CVC, and DOB. Contradicts README statement "We do not log card details." | Remove `body` from logged fields. Log only whitelisted safe fields (e.g., event type, timestamp). Implement request sanitization to strip sensitive fields before logging. |
| 2 | High | Security | **Sensitive data in error messages** | `src/billing.js:10` — Error message includes card number suffix: `"card ending ${String(payload.cardNumber).slice(-4)}"`. Even last 4 digits should not appear in error logs that ship to central log store. | Remove card number from error message entirely. Log only correlation ID and error code/status. |
| 3 | High | Reliability | **Unhandled error on response parsing** | `src/billing.js:11` — `res.json()` can throw if response body is not valid JSON; no try-catch wrapping this call. | Wrap `res.json()` in try-catch or use `.then()` error handler; re-throw with descriptive message. |
| 4 | High | Correctness | **Missing input validation** | `src/billing.js:4-9` — Payload passed directly to fetch without validating required fields (email, cardNumber, expiry, cvc, dateOfBirth). Malformed requests will fail at provider. | Add schema validation before calling fetch (e.g., using a validator library or manual checks). Return 400 with validation error details if payload is invalid. |
| 5 | High | Security | **Sensitive payload in error logs** | `src/server.js:27` — `payload: req.body` logged in error handler, exposing full card details in error event to central log store. | Log only safe metadata (correlation ID, request method/path). Remove payload entirely or log only a hash/redacted version. |
| 6 | Medium | Reliability | **Missing configuration validation** | `src/billing.js:5` — `process.env.BILLING_API` used without checking if set; fetch will fail with unclear error if missing. Similarly, `BILLING_KEY` is not validated. | Validate required environment variables at server startup. Throw descriptive error if `BILLING_API` or `BILLING_KEY` are not set. Consider using a configuration loader. |
| 7 | Medium | Maintainability | **Insufficient test coverage** | `test/log.test.js` — Only 1 test exists, covering only the `log()` utility function. No tests for the main subscription creation flow, error handling, or integration with billing provider. | Add tests for: (a) successful subscription creation flow; (b) error handling when billing API fails; (c) HTTP response codes and error messages; (d) correlation ID presence in logs. |
| 8 | Medium | Correctness | **Collision-prone correlation ID** | `src/server.js:10` — Correlation ID generated as `c${Date.now()}` using millisecond timestamps. Under high concurrency, multiple requests could receive identical IDs. | Use a UUID library (e.g., `crypto.randomUUID()` in Node 15.7+) to generate correlation IDs with negligible collision probability. |
| 9 | Medium | Maintainability | **Inaccurate documentation** | `README.md:9` — States "We do not log card details" but `src/server.js:15` logs full request body including card data. | Update README to clarify current logging behavior, or fix the logging behavior to match README promise. Audit all logging calls to ensure no PII is logged. |
| 10 | Low | Reliability | **Missing error details in HTTP response** | `src/server.js:28` — All errors return generic "could not create subscription" message regardless of root cause (network error, invalid payload, provider issue). Harder for clients to implement retry logic. | Consider returning different HTTP status codes based on error type (400 for validation errors, 500 for provider errors, 503 for transient failures). Keep error message generic for security, but vary status code. |

---

## Unconfirmed Issues

**Missing headers validation** — The code does not validate that `content-type: application/json` is actually set on the outbound request to the billing provider in all cases. If Express's `JSON.stringify()` fails for any reason, the Content-Type header would be incorrect but no error is caught. *Requires*: examining actual network behavior under error conditions.

**HTTPS enforcement** — No evidence that the billing provider URL is validated to use HTTPS. If `process.env.BILLING_API` is set to an HTTP URL, credentials could be transmitted in plaintext. *Requires*: validation of environment variable format at startup or enforcement in code.

---

## Summary

### Strengths

1. **Structured logging with correlation IDs** — The log utility correctly implements JSON-formatted logs with correlation IDs on every line, enabling end-to-end request tracing. Evidence: `src/log.js` and request correlation ID on all log calls.

2. **Appropriate error recovery in main handler** — The subscription endpoint wraps the async operation in try-catch and returns a 502 status for provider errors, rather than crashing the server. Evidence: `src/server.js:21-29`.

3. **Clear separation of concerns** — Logging, billing, and HTTP handling are in separate modules with single responsibilities. Evidence: `log.js`, `billing.js`, and `server.js` are independent.

### Key Risks

The most critical issue is **unintended logging of sensitive payment card data** (Findings #1, #2, #5). The README explicitly promises "We do not log card details," but the current implementation logs full card numbers, expiry dates, CVCs, and dates of birth to the central log store, which is retained for two years and searchable by the entire engineering team. This creates a compliance risk (PCI DSS) and privacy violation.

The second concern is **missing input validation** (Finding #4) allowing malformed requests to reach the payment provider, and **missing configuration validation** (Finding #6) risking runtime failures with unclear error messages.

The third is **untested critical path** (Finding #7). Only the logging utility has test coverage; the subscription creation flow itself has no tests.

### Priority Order

1. **[Finding #1] Remove body from request logs immediately** — Fix by whitelisting only safe fields in the middleware logger. Critical security issue with active data leakage.

2. **[Finding #5] Remove payload from error logs** — Stop logging request body in the error handler. Same data-leakage risk as #1.

3. **[Finding #2] Remove card number from error messages** — Even partial card numbers should not appear in logs. Quick fix, high impact.

4. **[Finding #4] Add request validation** — Validate required fields before calling billing API. Improves error handling and prevents provider errors.

5. **[Finding #6] Validate required environment variables at startup** — Fail fast with clear errors if `BILLING_API` or `BILLING_KEY` are missing.

6. **[Finding #8] Replace Date.now() correlation IDs with UUID** — Reduces collision risk under high concurrency.

7. **[Finding #7] Add test coverage for subscription and error flows** — Ensure the main business logic is validated.

8. **[Finding #9] Update README** — Document actual logging behavior once #1, #2, #5 are fixed, or clarify the current state if logging cannot be changed immediately.

9. **[Finding #10] Vary HTTP status codes by error type** — Helps clients implement better retry logic.

### Coverage Gaps

- **Dependency security audit** — `npm audit` was not run; known vulnerabilities in Express 4.19.0 or other dependencies are not identified.
- **Linting and code style** — No ESLint or code quality checks were run; style consistency is not verified.
- **Environment and deployment** — Production environment, database configuration, and deployment pipelines were not examined.
- **Integration testing** — No verification that the code works correctly with the actual billing provider API.
- **Load and performance testing** — No testing under concurrent load; correlation ID collision risk and throughput are not validated.
- **Authentication and authorization** — No verification of how the service itself is authenticated or rate-limited by callers.
- **Data retention and purging** — No evidence of how card data or subscription data is retained or deleted after creation.

