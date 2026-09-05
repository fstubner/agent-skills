# Subscriptions API Assessment

## Scope

**In scope:**
- `src/server.js` — Express application and request handling
- `src/billing.js` — Payment provider integration  
- `src/log.js` — Structured logging implementation
- `test/log.test.js` — Test suite
- `package.json` — Dependencies and build configuration

**Out of scope:**
- External payment provider API (Stripe, etc.)
- Production deployment configuration
- Infrastructure and monitoring setup
- Integration with the central log store

**Depth:** Targeted — all in-scope files read in full.

---

## Environment

- **Language/Runtime:** JavaScript (ES modules), Node.js
- **Framework:** Express.js (v4.19.0)
- **Build tooling:** None configured (no build step)
- **Testing:** Node's built-in `test` module
- **Domain:** HTTP API for payment subscriptions
- **Dependencies:** Only Express.js; no dev dependencies listed

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | ✓ Passed: 1 test (log function), 0 failures, ~102ms |
| `npm audit` | Not run (permission required) |
| `eslint .` | Not available (not installed) |
| `tsc --noEmit` | Not available (not installed) |
| `prettier --check .` | Not available (not installed) |
| `npm run build` | Not defined in scripts |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Complete payment card details logged in request body | `src/server.js:15` — logs `req.body` which includes full card number, expiry, CVC, and date of birth. Contradicts README: "We do not log card details." | Exclude sensitive fields from logging. Use middleware to sanitize `req.body` before logging; never log: `cardNumber`, `cvc`, `expiryMonth`, `expiryYear`, or `dateOfBirth`. Validate with actual payment provider to confirm PCI compliance. |
| 2 | **Critical** | Security | Authorization token exposed in logs | `src/server.js:16` — logs all headers including `authorization` header containing `Bearer ${process.env.BILLING_KEY}`. | Remove `authorization` header from logged headers. Implement a header filtering function to exclude sensitive fields. |
| 3 | **Critical** | Reliability | Unresolved promise in billing creation | `src/billing.js:11` — returns `res.json()` without `await`. The function returns a Promise that resolves to the JSON parse, but if parsing fails, the error is not caught; if the response body is not JSON, it throws. | Add `await res.json()` and wrap in try/catch. Or use `await res.json()` and return the result explicitly. Current code: `return res.json();` should be `return await res.json();` |
| 4 | **High** | Security | Card number leaked in error messages | `src/billing.js:10` — error message includes `String(payload.cardNumber).slice(-4)`. Even partially exposed card numbers can be logged and retained for two years. | Remove card information from error messages entirely. Use only payment provider's transaction ID or reference number. |
| 5 | **High** | Data Integrity | No input validation on subscription payload | `src/billing.js:4` — `createSubscription(payload)` accepts payload without checking required fields (email, cardNumber, cvc, expiry, dateOfBirth). | Add input validation: check presence and type of required fields. Reject requests missing `cardNumber`, `expiryMonth`, `expiryYear`, `cvc`, `email` with clear 400 error. Use a schema validator (e.g., simple manual checks or a library like Zod). |
| 6 | **High** | Reliability | Missing error handling for network failures | `src/billing.js:5` — `fetch()` call can fail (timeout, connection refused, DNS failure). Currently only checks `res.ok` after successful network call. | Add try/catch around the `fetch()` call to handle network errors separately. Distinguish between network failure (retry-able) and billing API error (may not be retry-able). |
| 7 | **High** | Reliability | Insufficient test coverage | `test/log.test.js` — only 1 test covering the `log()` function. No tests for API route handler, `createSubscription()`, error handling, or the full request flow. | Add tests for: (1) POST /subscriptions happy path, (2) missing/invalid payload, (3) billing API failure (mock fetch to simulate 502), (4) correlation ID propagation, (5) error logging format. |
| 8 | **Medium** | Architecture | Hardcoded HTTP status code choice | `src/server.js:28` — returns 502 "Bad Gateway" for all subscription errors, regardless of root cause (missing field, card declined, network timeout). Response gives client no insight into what went wrong. | Return appropriate status codes: 400 for validation errors, 502 for external provider failures, 500 for internal errors. Include a `code` or `reason` field in the JSON response (without exposing system internals). |
| 9 | **Medium** | Maintainability | Correlation ID generation not testable | `src/server.js:10` — uses `Date.now()` directly, making correlation IDs non-deterministic and harder to mock in tests. | Consider injecting a timestamp source or making it configurable. For testing, mock or inject `req.correlationId` instead of relying on the middleware. |
| 10 | **Medium** | Reliability | No timeout on billing API call | `src/billing.js:5` — `fetch()` has no timeout. If the billing service hangs, the request will hang indefinitely. | Add a timeout to the fetch call (e.g., `signal: AbortSignal.timeout(5000)` in Node 17+, or use a third-party timeout wrapper). Set a reasonable timeout (5–10 seconds) based on expected billing provider SLA. |

---

## Unconfirmed Issues

**Card number exposure in error responses:**
- `src/billing.js:10` attempts to redact card details by logging only the last 4 digits.
- However, if the error is re-thrown or propagated, and if the full payload is available to error handlers, the entire card number *could* be exposed.
- Confirmation would require tracing error propagation in production and reviewing any error tracking/reporting systems (Sentry, etc.) — not visible in this codebase.
- **Recommendation:** Defensively assume the full error *could* be captured somewhere and remove all card-related info from error messages.

---

## Summary

### Strengths

1. **Structured logging with correlation ID** — Every request logs a correlation ID enabling end-to-end tracing through the central log store. Implementation is simple and effective (logs JSON to stdout).

2. **Separation of concerns** — HTTP handler, billing provider call, and logging are cleanly separated into three modules. Easy to test and modify independently.

### Key Risks

**Security (Findings #1, #2, #4):** The most critical issue is that the API logs complete payment card data and authorization credentials, directly contradicting the README and violating PCI compliance. The README states "We do not log card details," but the implementation logs `req.body` (which contains full card number, expiry, CVC) and all headers (which expose the `BILLING_KEY`). This creates a two-year retention liability.

**Reliability (Findings #3, #6, #7, #10):** The unresolved promise in `createSubscription()`, missing network error handling, no timeout on external calls, and minimal test coverage combine to create failure modes that could lose requests or hang indefinitely under adverse conditions.

**Data Integrity (Finding #5):** No validation of incoming payment data before forwarding to the billing provider means malformed or incomplete requests will silently fail, creating support burden and potential lost transactions.

### Priority Order

1. **[#1, #2]** Remove card details and secrets from logs immediately (blocking PCI compliance).
2. **[#4]** Remove card numbers from error messages (reduces data exposure surface).
3. **[#3]** Await `res.json()` in `createSubscription()` to fix unresolved promise.
4. **[#5]** Add input validation for required subscription fields.
5. **[#6, #10]** Add network error handling and timeout to `fetch()` call.
6. **[#8]** Differentiate error responses by status code (400, 502, 500) and add error reason codes.
7. **[#7]** Expand test coverage to include API handler, error cases, and full request flow.
8. **[#9]** Make correlation ID generation testable (optional; lower priority).

### Coverage Gaps

- **No build/compilation step:** The project has no TypeScript compiler, bundler, or build step configured, so type safety is not enforced. Unknown whether this is intentional (plain JavaScript) or an oversight.
- **No static analysis tools:** eslint, Prettier, and other linters are not installed or configured. Code style and quality checks must be manual.
- **No package-lock.json or dependency audit output:** Could not run `npm audit` to check for known vulnerabilities in Express.js (v4.19.0). Recommend running manually before deployment.
- **No integration test environment:** Tests only exercise the `log()` function; no test for the full HTTP request path or mock of the billing provider API.
- **Production configuration unknown:** No inspection of environment variables, error tracking setup, or log shipping configuration — all assumed working per README but not verified in code.
- **Billing provider contract unknown:** No documentation of required fields, response format, or error codes from the payment provider. Input validation designed by guessing from comments.
