# Subscriptions API Assessment

## Scope

**In scope**: 
- `src/server.js` — request handling, logging, error responses
- `src/billing.js` — external payment provider integration
- `src/log.js` — structured logging implementation
- `test/log.test.js` — existing test coverage
- `package.json` — dependencies and scripts

**Out of scope**:
- Deployment configuration, CI/CD pipelines, operational monitoring
- External payment provider API contract details (testing against actual API)
- Frontend integration or client-side behavior
- Load testing, penetration testing, production traffic patterns

**Depth**: `targeted` — all in-scope files read in full. Automated checks attempted but environment constraints prevent execution of test suite and linting tools.

---

## Environment

**Language**: JavaScript (Node.js ES modules)
**Runtime**: Node.js 18+ (inferred from `node:test` import and `--test` flag in package.json)
**Framework**: Express.js 4.19.0
**Domain**: REST API for subscription creation with external payment provider integration
**Platform**: Server-side API
**Build/Test System**: npm scripts (test script only; no build process)

---

## Tooling Results

### Commands Attempted

| Command        | Result                                                     |
|----------------|-------------------------------------------------------------|
| `npm test`     | Not executed — requires environment approval               |
| `npm run build`| No build script defined in package.json                    |
| `eslint`       | Not installed; no config present                           |
| `node --check` | Not attempted; would require file-by-file execution       |

### Tools Unavailable

- **Testing**: `npm test` could not be executed (approval required). The test file exists (`test/log.test.js`) and covers the log module but does not test the server endpoint or billing integration.
- **Linting**: No linter configured; code style consistency cannot be verified.
- **Type checking**: No TypeScript or JSDoc type annotations present; static type analysis unavailable.
- **Dependency audit**: `npm audit` not executed; known vulnerability status unknown.

---

## Findings Table

| # | Severity | Area         | Finding                                           | Evidence                                                | Recommendation                                                   |
|---|----------|--------------|---------------------------------------------------|--------------------------------------------------|-----------------------------------------------------------------|
| 1 | Critical | Security     | Full card data logged in request handler         | `src/server.js:15` logs `req.body` containing full card number, expiry, CVC; violates PCI-DSS logging restrictions | Remove card fields from logged payload; hash/truncate sensitive data before logging |
| 2 | Critical | Security     | Card data exposed in error messages              | `src/billing.js:10` includes `payload.cardNumber` in error string; leaks sensitive data to logs/external systems | Replace with sanitized error message (e.g., "card ending in ..."); never include full card data |
| 3 | High     | Reliability  | No input validation on subscription payload      | `src/billing.js:4-5` passes payload directly to external API without validating required fields (email, card, DOB) | Add validation for required fields before forwarding to billing API |
| 4 | High     | Reliability  | Unhandled promise rejection in billing          | `src/billing.js:11` calls `res.json()` without error handling; if JSON parsing fails, promise rejects uncaught | Add `.catch()` or wrap in try-catch to handle JSON parsing errors |
| 5 | Medium   | Reliability  | Generic error response masks root cause          | `src/server.js:28` returns generic "could not create subscription" without status code or reason; client cannot determine if retryable or diagnostic | Return specific error codes (e.g., 400 for validation, 503 for temporary service failure) or include error identifier |
| 6 | Medium   | Reliability  | Weak correlation ID generation                   | `src/server.js:10` uses `Date.now()` for correlation IDs; high throughput can cause collisions; not suitable for distributed tracing | Use cryptographically unique IDs (e.g., `crypto.randomUUID()` or UUID library) |
| 7 | Low      | Maintainability | Misleading function documentation               | `src/billing.js:1-3` comments mention affordability check but code does not implement or validate DOB; unclear if caller must provide this field | Update comment to accurately reflect function behavior; clarify which fields are required vs. optional |

---

## Unconfirmed Issues

**No unconfirmed issues identified.** All findings above are supported by direct evidence from source code examination.

---

## Summary

### Strengths

1. **Structured logging with correlation IDs**: The logging module (`src/log.js`) correctly implements JSON-formatted structured logs that allow request tracing end-to-end. The correlation ID pattern enables operators to follow a single user request through the system (`src/server.js:10-18`).

2. **Appropriate HTTP error status code**: The API correctly uses HTTP 502 (Bad Gateway) when the external billing service fails, signaling to clients that the failure is external and potentially transient (`src/server.js:28`).

3. **Defensive error logging**: The error handler logs the full error object including stack trace, which aids debugging in production (`src/log.js:7-10`).

### Key Risks

The codebase has **two Critical findings** (findings #1 and #2) both involving exposure of sensitive payment card data:

- **Finding #1** violates PCI-DSS Requirement 3.4 (logging of sensitive authentication data) by logging full card numbers in the request handler middleware.
- **Finding #2** compounds the risk by including card data in exception messages where it will be captured in error logs accessible to the engineering team.

Together, these create a compliance violation and data breach risk that must be resolved before the API handles real payment data.

**Finding #3 and #4** (High severity) expose the API to downstream failures: unvalidated input forwarded to the billing service may produce cryptic responses; unhandled JSON parsing errors can crash the request handler.

### Priority Order

1. **Remove card data from logs** (Finding #1) — Implement field filtering in the request middleware to exclude `cardNumber`, `cardExpiry`, `cardCvc` before logging. This is a compliance requirement.

2. **Sanitize error messages** (Finding #2) — Replace `payload.cardNumber` reference in `src/billing.js:10` error string with truncated/safe representation (e.g., "last 4 digits") or a generic message.

3. **Add input validation** (Finding #3) — Validate that `email`, `cardNumber`, `cardExpiry`, `cardCvc`, and `dateOfBirth` are present and well-formed before forwarding to billing API. Return 400 with validation errors to the client.

4. **Handle JSON parsing errors** (Finding #4) — Wrap `res.json()` call in `src/billing.js:11` with error handling to ensure unhandled rejections do not crash the request handler.

5. **Improve error responses** (Finding #5) — Include error context (validation failures, service unavailability codes) in the 502 response to aid client-side debugging and retry logic.

6. **Upgrade correlation ID generation** (Finding #6) — Replace `Date.now()` with a cryptographically unique identifier to prevent collisions in high-throughput scenarios.

### Coverage Gaps

**Not examined** (and could not verify without additional tools/access):

- **Runtime behavior**: The test suite could not be executed. The single test in `test/log.test.js` covers only the `log()` function; the HTTP endpoint, error handling, and integration with the billing service are untested.
- **Dependency vulnerabilities**: `npm audit` was not run; no known CVE status for express 4.19.0 or transitive dependencies is available.
- **Code style/consistency**: No linter or formatter is configured; formatting, naming, and style adherence could not be verified.
- **Type safety**: No TypeScript or JSDoc type annotations; static type checking is not performed.
- **Production observability**: No metrics on error rates, latency, or payment success rates; observability setup is unknown.
- **Secrets management**: The code references `process.env.BILLING_API` and `process.env.BILLING_KEY` but their secure handling in deployment is not visible; could not verify that keys are not committed to the repository.

---

## What I Ran

**Test execution**: `npm test` — Approval required; not executed. Test file exists (`test/log.test.js`) and defines one test for the logging module.

**Build check**: No build script defined in `package.json`; skipped.

**Static analysis**: No linter, formatter, or type checker configured; tools not available.

**Dependency audit**: `npm audit` not executed; vulnerability status unknown.
