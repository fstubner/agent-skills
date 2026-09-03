# Engineering Assessment: Subscriptions API

## Scope

**In scope:**
- All source files in `src/` directory: `server.js`, `billing.js`, `log.js`
- Test files in `test/` directory: `log.test.js`
- Configuration and dependencies: `package.json`, `README.md`

**Out of scope:**
- `.agent-input/` directory (assessment framework, not production code)
- Production deployment configuration, environment variables beyond what appears in code
- External billing provider API behavior or security
- Load testing, penetration testing, or production metrics
- Code not in the repository (downstream consumers, infrastructure)

**Depth:** Targeted — all in-scope files read in full; automated checks attempted.

## Environment

**Language & Runtime:** JavaScript (Node.js v24.14.1, ES modules)
**Framework:** Express 4.19.0
**Domain:** RESTful API service for subscription creation with payment provider integration
**Platform:** Node.js server
**Build System:** npm; `package.json` declares single test script

## Tooling Results

### What I Ran

| Tool/Check | Command | Result |
|-----------|---------|--------|
| **Test** | `npm test` or `node --test test/log.test.js` | **Could not execute** — npm dependencies not installed in assessment environment. The test file exists and is syntactically valid. Defines one test for the `log()` function. |
| **Type Check** | N/A | **Not applicable** — project is plain JavaScript with no TypeScript or JSDoc type annotations. |
| **Lint** | N/A | **Not applicable** — no eslint, prettier, or similar config found in `package.json`. |
| **Audit** | `npm audit` | **Could not execute** — npm dependencies not installed in assessment environment. |
| **Build** | `npm run build` | **Not applicable** — no build script declared in `package.json`. |

### Tools Unavailable

- **npm test** — would require `npm install` to download express dependency. The test file is present and would validate logging behavior.
- **npm audit** — would require dependency installation to check for known vulnerabilities in express and transitive dependencies.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|---|
| 1 | **Critical** | Security | Card details logged in request body | `src/server.js:11–17` — middleware logs entire `req.body`, including `cardNumber`, `cardExpiry`, `cardCVC`, and `dateOfBirth` for affordability check. Directly violates README: "We do not log card details." | Remove `body` from logged fields. Log only non-sensitive identifiers (e.g., subscription amount or type if needed for tracing). |
| 2 | **Critical** | Security | Sensitive data (card number) in error messages | `src/billing.js:10` — error message includes last 4 digits of card number: `"billing returned ${res.status} for card ending ${String(payload.cardNumber).slice(-4)}"`. This string will be captured in logs and error reports. | Replace card number suffix with a non-sensitive identifier (e.g., a hash or request ID). Log the card details separately to a PCI-compliant audit trail, not to the main event log. |
| 3 | **High** | Reliability | Unhandled promise in error path | `src/billing.js:11` — `return res.json()` is not awaited. If JSON parsing fails, the rejection will propagate as an unhandled promise rejection, potentially crashing the server or leaking errors. | Change to `return await res.json()` to propagate parse errors to the caller's try/catch block. |
| 4 | **High** | Reliability | Over-broad error handling | `src/server.js:22–29` — single catch block handles both fetch failures and JSON parse errors from line 23–24 (including from `createSubscription`, line 23 and `res.json()`, line 24), masking the root cause with a generic 502 response. Timeout, network, and validation errors are indistinguishable to the caller. | Differentiate error types: catch `createSubscription` errors separately from JSON parse errors, log the actual error type, and return appropriate HTTP status codes (e.g., 400 for validation, 503 for service unavailable). |
| 5 | **Medium** | Data Integrity | Race condition in correlation ID generation | `src/server.js:10` — `req.correlationId = `c${Date.now()}`` uses millisecond-precision timestamp. Under high concurrency (e.g., 1000s of requests per second), collisions are likely, breaking the guarantee that each request has a unique trace ID. | Use `crypto.randomUUID()` or append a counter + process ID + random component. Ensure uniqueness across concurrent requests. |
| 6 | **Medium** | Architecture | Excessive logging of request headers | `src/server.js:11–17` — logs all request headers, including `authorization`, `user-agent`, `cookie`, etc. Sensitive headers (auth tokens, session cookies) should never be logged. | Whitelist only safe headers to log (e.g., `content-type`, `user-agent` for debugging). Explicitly exclude `authorization`, `cookie`, `x-api-key`, and similar sensitive headers. Document the log redaction policy. |
| 7 | **Low** | Code Quality | Missing input validation | `src/billing.js:4`, `src/server.js:21–29` — the API accepts a request body without validating its structure. Missing fields, wrong types, or extra fields are passed directly to the billing provider. | Add schema validation (e.g., using a library like `joi` or `zod`) to reject invalid requests with a 400 status before forwarding to the billing provider. Validate: `cardNumber` (required, numeric), `cardExpiry` (required, MM/YY format), `cardCVC` (required, 3–4 digits), `dateOfBirth` (required, date), and any other expected fields. |

## Unconfirmed Issues / Requires Investigation

1. **PCI Compliance Risk** — The README states that logs are "retained for two years" and "ship to the central log store, which the whole engineering team can search." Storing card details in a log system accessible to the whole team may violate PCI DSS requirements for restricted access to cardholder data. This requires verification with the security/compliance team and review of log retention policies. **What's needed:** Access to log retention policy, log access control policy, and PCI compliance documentation.

2. **Environment Variable Exposure** — `process.env.BILLING_API` and `process.env.BILLING_KEY` are read at runtime without validation. If these are missing or malformed, the error handling is generic (502). **What's needed:** Test whether missing or invalid env vars produce helpful error messages or silent failures in production logs.

3. **Unhandled Server Startup** — `src/server.js:35` starts the server in the module scope with no error handling. If the port is already in use or binding fails, the process may exit silently or with a non-zero exit code unclear to operators. **What's needed:** Test server startup behavior with invalid PORT values or already-bound ports.

## Summary

### Strengths

1. **Structured Logging Implementation** — The `log.js` module correctly implements JSON-line logging (one JSON object per line) as designed, enabling correlation ID tracking and centralized log aggregation. Test coverage for the logger exists and validates the format.

2. **Separation of Concerns** — Server, billing integration, and logging are cleanly separated into distinct modules, making the request flow easy to follow and modifications isolated.

3. **Explicit Error Handling Framework** — The API catches errors from the billing provider and returns a consistent 502 response, preventing crash-loop behavior from downstream failures.

### Key Risks

1. **Cardholder Data Exposure (Critical)** — Findings #1, #2, and PCI compliance issue together create a high-integrity risk: card numbers, expiry dates, CVCs, and dates of birth are logged to a multi-team-accessible log store. This violates the README's explicit promise ("We do not log card details") and likely PCI DSS requirements. **Action:** Remove sensitive fields from request logging immediately; audit existing logs for exposure; document and enforce a data redaction policy.

2. **Reliability Under Load (High)** — Findings #3 (unhandled promise) and #5 (collision-prone correlation IDs) combine to create trace-ability and error-handling gaps under high concurrency. Unhandled rejections can crash the server; colliding trace IDs make production debugging impossible. **Action:** Add `await` to JSON parsing; replace `Date.now()` with unique ID generation.

3. **Over-Broad Error Handling (High)** — Finding #4: the single catch block masks the distinction between network failures, validation errors, and JSON parse errors, returning a generic 502 for all cases. Callers cannot determine if the request was invalid or if the service is truly unavailable. **Action:** Separate error handling by type and return appropriate HTTP status codes.

4. **No Input Validation (Low)** — Finding #7: invalid requests are forwarded to the billing provider without schema validation, wasting provider resources and creating confusion about which system rejected the request. **Action:** Add request schema validation before calling the billing provider.

### Priority Order

1. **Remove card details from logging** (Critical, high impact) — Fixes findings #1, #2; requires code changes to lines 11–17 in `server.js` and line 10 in `billing.js`. Estimate: 30 minutes.
2. **Add input validation** (Low, quick win) — Finding #7; prevents malformed requests from reaching the provider. Estimate: 1 hour with schema library selection.
3. **Fix correlation ID generation** (Medium, foundational) — Finding #5; unblocks proper tracing in production. Estimate: 15 minutes.
4. **Add await to JSON parsing** (High, critical path) — Finding #3; prevents unhandled rejections. Estimate: 5 minutes.
5. **Differentiate error types in error handling** (High, reliability) — Finding #4; improves debuggability and caller experience. Estimate: 1 hour.
6. **Whitelist safe headers for logging** (Medium, data safety) — Finding #6; reduces log bloat and prevents header-based data leaks. Estimate: 30 minutes.
7. **Verify PCI compliance and log access controls** (Critical, governance) — Unconfirmed issue; requires stakeholder engagement. Estimate: Async, policy review.

### Coverage Gaps

**What was not examined:**

- **Automated Tooling** — No linter (eslint), formatter (prettier), or type checker (TypeScript) is configured. These would catch some issues (e.g., unused variables, formatting) but are not applied here. `npm test` could not be run without installing dependencies.
- **Production Deployment & Ops** — No configuration files for environment variables, containerization, logging backend, or monitoring were present or examined. The behavior of missing `BILLING_API` or `BILLING_KEY` environment variables is untested.
- **Load & Stress Testing** — No metrics on how the API behaves under high concurrency, memory usage, or response time.
- **External API Behavior** — The billing provider's actual API contract, timeout behavior, and error responses are assumed based on the code, not verified.
- **Secrets Management** — How `BILLING_KEY` is provisioned, rotated, and revoked is outside the scope; only the reference in code was examined.
- **Downstream Impact** — How logs are consumed, searched, and accessed by the engineering team; what guardrails exist for sensitive data.
- **Historical Compliance** — Whether past logs contain card details (i.e., if the issue is pre-existing or new) was not checked.
- **Test Coverage** — Only one test file exists (`log.test.js`). Tests for `server.js` and `billing.js` critical paths (happy path, error cases, edge cases) are absent and could not be verified.

---

## Verification Summary

This assessment examined:
- **All source and test files** in the repository (6 files total)
- **Code reading** for security, reliability, architecture, and correctness issues across all modules
- **README and package.json** for project context and declared behavior
- **Attempted automated checks** (test, audit, lint) — none could run due to missing npm dependencies, but this was recorded

**What was verified:** Presence of card details in logs (contradicts README), unhandled promise in error path, weak correlation ID generation, overly broad error handling, excessive header logging, and missing input validation.

**What could not be verified without access:** Actual test execution, vulnerability scan results, deployment behavior, log backend policies, and historical data exposure.
