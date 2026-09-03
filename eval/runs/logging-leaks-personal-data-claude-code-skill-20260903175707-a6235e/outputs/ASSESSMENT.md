# Subscriptions API - Engineering Assessment

## Scope

**In scope:** 
- Core application logic in `src/` directory: server.js, log.js, billing.js
- Test suite in `test/` directory: log.test.js
- Configuration and dependencies: package.json, README.md
- Depth: **Targeted** — every file in the in-scope list read in full

**Out of scope:**
- External API (BILLING_API) behavior and security
- Production deployment configuration
- Load testing and performance benchmarking
- Penetration testing of deployment environment

---

## Environment

**Languages and runtimes:** Node.js with ES modules

**Frameworks and libraries:** Express.js 4.19.0

**Domain:** REST API for payment subscriptions with structured JSON logging

**Platform targets:** Server (Node.js)

**Build systems:** npm with Node's built-in test runner

---

## What I Ran

Attempt to run tests:
- Command: `npm test`
- Status: Attempted but not executed (approval required for bash execution)
- Expected behavior: Runs test/log.test.js using Node's built-in test runner

No other automated checks (lint, type-check, audit) are configured in package.json.

---

## Findings Table

| # | Severity | Area         | Finding              | Evidence                  | Recommendation              |
|---|----------|--------------|----------------------|---------------------------|-----------------------------|
| 1 | Critical | Security     | Card details logged in error messages | `src/billing.js:10` — error message includes last 4 digits of card number: `for card ending ${String(payload.cardNumber).slice(-4)}` | Remove card details from error messages. Log a masked identifier or reference number instead. |
| 2 | Critical | Security     | Full request headers and body logged, including sensitive card data | `src/server.js:15` — logs all headers and body: `body: req.body, headers: req.headers` which includes full card number, CVC, expiry, and DOB per the billing.js comment | Implement request sanitization to exclude sensitive fields (cardNumber, cvc, expirationDate, dateOfBirth) before logging. Use allowlist approach. |
| 3 | Critical | Data Integrity | No input validation before sending to payment provider | `src/billing.js:4-8` — payload is passed directly to fetch without validation of required fields, data types, or format | Validate request payload schema (email, cardNumber, cvc, expirationDate, dateOfBirth) before sending to billing API. Reject invalid requests with 400 status. |
| 4 | Critical | Correctness | Unhandled error in JSON response parsing | `src/billing.js:11` — `res.json()` can throw if response body is not valid JSON, but error is not caught | Wrap `res.json()` in try-catch or use `res.json().catch()` to handle parse errors. Return descriptive error to client. |
| 5 | High     | Reliability  | All errors return 502 status code regardless of actual error type | `src/server.js:28` — all caught exceptions result in 502 response with generic message | Differentiate error types: return 400 for validation errors, 401/403 for auth errors, 502 only for actual service unavailability. Log actual error details. |
| 6 | High     | Security     | No rate limiting on subscription endpoint | `src/server.js:21-30` — POST /subscriptions has no rate limiting middleware | Implement rate limiting (e.g., express-rate-limit) to prevent brute force attacks on payment creation. Set to 5-10 requests per minute per IP/user. |
| 7 | High     | Correctness  | Correlation ID uses timestamp only without uniqueness guarantee | `src/server.js:10` — correlation ID is `c${Date.now()}`, which can collide under high concurrency (multiple requests in same millisecond) | Use UUID v4 or combine timestamp with random bytes: `${Date.now()}-${crypto.randomUUID()}`. |
| 8 | Medium   | Architecture | No schema validation for incoming requests | `src/server.js:21-30` — POST /subscriptions accepts any JSON without validating required fields or types | Add schema validation library (e.g., zod, joi) to validate email format, card number format (Luhn check), required fields, and data types. |
| 9 | Medium   | Reliability  | fetch() call has no timeout, can hang indefinitely | `src/billing.js:5` — `fetch()` without timeout parameter could cause request to hang if billing API is slow or unresponsive | Set AbortController with 10-30 second timeout: `const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30000);` |
| 10 | Medium  | Maintainability | Only log.js module has test coverage | `test/log.test.js` — tests only the log function; server.js and billing.js have zero coverage | Write integration tests for POST /subscriptions endpoint covering success case, billing API failures, and invalid inputs. Aim for >70% coverage. |
| 11 | Low     | Maintainability | No environment variable validation on startup | `src/server.js:35` and `src/billing.js:5` — BILLING_API and BILLING_KEY used without checking if set | Add startup validation: throw error if BILLING_API or BILLING_KEY are missing before starting server. |

---

## Unconfirmed Issues

None identified that are not listed in the findings table above.

---

## Summary

### Strengths

1. **Structured logging with correlation IDs** — The API implements correlation IDs on every log line (src/log.js:3-4), enabling end-to-end request tracing across distributed systems. This is a best practice for debugging production issues.

2. **Modular separation of concerns** — The codebase cleanly separates server routing (server.js), logging (log.js), and billing integration (billing.js), making the code easy to understand and test independently.

### Key Risks

The most critical issues are security vulnerabilities related to sensitive payment data exposure:

- **Finding #1, #2**: Card details and other PII are logged and included in error messages. Given the README explicitly states "We do not log card details," this is a direct violation of stated policy and creates compliance risk (PCI-DSS, data protection regulations).

- **Finding #3**: Lack of input validation allows malformed requests to reach the payment provider, potentially causing failures or unexpected behavior.

- **Finding #4, #5**: Error handling is incomplete and generic. Specific errors could be masked, making debugging difficult and returning incorrect HTTP status codes to clients.

- **Finding #7**: Correlation ID collision risk under high load could break end-to-end tracing.

### Priority Order

1. **Find #1, #2**: Immediately remove sensitive data from logs and error messages. This is a critical compliance and security issue. Estimated effort: 1-2 hours.

2. **Find #3**: Add request schema validation before sending to billing API. Prevents invalid data from reaching the payment provider. Estimated effort: 2-3 hours.

3. **Find #6**: Implement rate limiting on POST /subscriptions to prevent brute force attacks. Estimated effort: 1 hour.

4. **Find #7**: Fix correlation ID generation to guarantee uniqueness under concurrency. Estimated effort: 30 minutes.

5. **Find #4, #5**: Improve error handling with proper status codes and error-type differentiation. Estimated effort: 2-3 hours.

6. **Find #8, #9**: Add schema validation and timeout handling for robustness. Estimated effort: 2-3 hours.

7. **Find #10, #11**: Increase test coverage and validate environment variables on startup. Estimated effort: 3-4 hours.

### Coverage Gaps

**Not examined:**
- Billing API integration details (authentication, expected response format, error codes, rate limiting behavior)
- Production deployment configuration and environment variables
- TLS/HTTPS certificate validation and security headers
- Database persistence layer (if any)
- Authentication/authorization of API callers (all requests accepted)
- Network security (firewalls, service mesh policies)
- Load testing and performance characteristics
- Integration with external log store mentioned in README
- Compliance auditing (PCI-DSS, GDPR, SOC 2 requirements beyond logging)

**Tools not run:**
- `npm audit` — not run (would require bash approval); would reveal dependency vulnerabilities
- `eslint` — not configured; could catch code quality issues
- `prettier` — not configured; would enforce code formatting
- Type checking — no TypeScript; JavaScript has no static type checking

**Testing not performed:**
- Load testing under high concurrency
- Failure scenario testing (billing API down, timeout, malformed response)
- Security penetration testing
- Card number validation (Luhn check, issuer detection)

---

## Verified

✓ Read all source files (server.js, log.js, billing.js, log.test.js)
✓ Reviewed package.json and README.md
✓ Identified security vulnerabilities in logging and error handling
✓ Found critical data validation gaps
✓ Located correlation ID collision risk
✓ Noted missing test coverage for core business logic
✓ Documented coverage gaps and tools not run
