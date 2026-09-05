# Subscriptions API - Engineering Assessment

## Scope

**In scope:**
- All source code: `src/server.js`, `src/billing.js`, `src/log.js`
- All test code: `test/log.test.js`
- Configuration: `package.json`, `README.md`

**Out of scope:**
- External billing provider API behavior or security posture
- Production deployment configuration, infrastructure, or monitoring
- Client integration patterns or usage examples
- Data retention and purging policies beyond what's in documentation

**Depth:** Targeted — every in-scope file read in full; automated checks run where applicable.

---

## Environment

**Language & Runtime:** Node.js (ES modules), JavaScript  
**Framework:** Express.js (^4.19.0)  
**Domain:** REST API for payment subscription creation  
**Platform:** Server-side HTTP API  
**Build System:** npm

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test --prefix "C:/tmp/agent-skills-eval-L8AP3b/workspace"` | ✅ PASS: 1 test passed, 0 failed (102.8734ms) |
| `npm audit --prefix "C:/tmp/agent-skills-eval-L8AP3b/workspace"` | ⏭️ Attempted but requires external approval; npm install not available in this context |
| `node_modules` check | ✅ Confirmed: test runs against uninstalled dependencies (Node.js built-in modules only), so dependency tree cannot be verified in this environment |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Security | Sensitive request data logged in full | `src/server.js:15-16` — entire `req.body` and `req.headers` are logged via `log()`. Card numbers, expiry, CVC, date of birth all included in structured logs. README states "We do not log card details" but code contradicts this. | Remove `body` and `headers` from request.received log. Log only method, path, and correlationId for request tracing. |
| 2 | High | Security | Secrets exposure in error messages | `src/billing.js:10` — card number (last 4 digits) leaked into error messages and logs via `logError()`. Error strings are captured in logs retained for 2 years per README. | Remove card details from all error messages. Log only status code and correlation ID. Use error codes (e.g., BILLING_ERROR_400) instead of raw card data. |
| 3 | High | Correctness | Missing environment variable validation | `src/billing.js:5-7` — `process.env.BILLING_API` and `process.env.BILLING_KEY` used without existence or format checks. Server will fail silently with malformed fetch URLs if unset. | Validate both env vars on startup (`src/server.js` module load). Throw with clear error message if missing: `Missing required env var: BILLING_API`. |
| 4 | High | Reliability | Unvalidated input passed to external API | `src/billing.js:8` — `payload` passed directly to `JSON.stringify()` and sent to billing provider without validation. Malformed, missing, or unexpected fields cause downstream failures without indication to caller. | Add input validation before fetch: validate required fields (email, cardNumber, expiry, cvc, dateOfBirth), string lengths, and data types. Return 400 with field-specific errors if validation fails. |
| 5 | High | Reliability | Incorrect HTTP status code for all errors | `src/server.js:28` — all subscription errors return 502 (Bad Gateway). This conflates validation errors (400), provider errors (502), and auth failures (403), making client error handling impossible. | Distinguish error types: return 400 for validation failures, 502 for billing provider connection issues, 503 for provider service unavailable. Parse billing error response status. |
| 6 | Medium | Correctness | Correlation ID collision risk under load | `src/server.js:10` — `Date.now()` has millisecond precision; under high throughput (>1000 req/sec), multiple requests will share the same correlation ID, breaking end-to-end tracing. | Use a UUID library (e.g., `crypto.randomUUID()` in Node 15.7+) or `Date.now() + process.hrtime.bigint()` for microsecond-level uniqueness. |
| 7 | Medium | Architecture | No input schema validation library | `src/server.js` and `src/billing.js` — no schema validation (e.g., Zod, Joi, Ajv). Field mismatches, type errors, and edge cases slip through to the billing API. | Adopt a lightweight schema validation library (e.g., `zod` ~12KB) or write inline validators for email format, card number length, date of birth range. Document expected payload schema in README or OpenAPI spec. |
| 8 | Medium | Maintainability | Unhandled async error in middleware chain | `src/server.js:9-19` — middleware does not use `next(error)` or `try-catch`. If `req.body` is extremely large or parsing fails, the error propagates without `logError()` being called, leaving the request untraced. | Add try-catch wrapper around the middleware logic. If parsing or logging fails, call `next(error)` with a pre-prepared error handler to ensure all errors are logged. |
| 9 | Medium | Security | SSRF risk in external API URL | `src/billing.js:5` — `BILLING_API` env var controls fetch destination. If environment is compromised or env var is injected by untrusted process, requests could be sent to attacker-controlled server. | Hardcode allowed billing API domain(s) or maintain a whitelist. Validate `BILLING_API` env var against this list on startup. Reject any URL not matching expected domain. |
| 10 | Low | Maintainability | No request size limit configured | `src/server.js:7` — `express.json()` has no `limit` option. Default is 100KB, but large requests (e.g., malicious payloads, accidental base64 images) can consume memory. | Add explicit size limit: `app.use(express.json({ limit: '10kb' }))` appropriate for typical card subscription payloads (~500 bytes). |

---

## Unconfirmed Issues

**Requires Investigation:**

1. **Correlation ID Uniqueness Guarantee** — While `Date.now()` collision risk is confirmed (Finding #6), the actual production throughput profile is unknown. If the service genuinely handles <1000 req/sec, collisions may be rare enough that tracing suffers only under spike scenarios. **Recommendation:** Review production traffic graphs; if peak throughput is consistently >1000 req/sec, prioritize UUID change.

2. **Billing Provider Error Response Format** — The code assumes the billing API returns JSON on error (line 11: `return res.json()`), but does not verify `res.ok` or handle `res.status` codes before parsing. If the provider returns non-JSON on failure, this crashes. **Recommendation:** Inspect actual billing provider API documentation; add error handling before `.json()` call.

3. **Logging Retention Compliance** — README states logs are retained for 2 years and searchable by the engineering team. Storing card details (even last 4 digits) in searchable logs may violate PCI DSS 3.2.1 (no storage of full PAN) or regional regulations (e.g., GDPR, if EU customers). **Recommendation:** Confirm with compliance/security team whether last-4-digit retention is acceptable; document finding in security policy.

---

## Summary

### Strengths

1. **Structured Logging Architecture** — JSON logging with correlation IDs enables end-to-end request tracing. Test coverage for log formatting confirms reliability of the logging layer (`test/log.test.js` passes).
2. **Clean Code Organization** — Separation of concerns (server, billing, logging) is clear. Each module has a single responsibility and minimal coupling.
3. **Async/Await Pattern** — Proper use of async/await in the subscription handler avoids callback hell and makes error flow explicit.

### Key Risks

**Critical Path Blocking (Findings #1, #2):** Sensitive payment data (full card numbers, expiry, CVC, date of birth) is logged in cleartext to stdout. Combined with 2-year retention stated in README, this creates a compliance and security breach risk. This must be fixed before production use.

**Functional Gaps (Findings #3, #4, #5):** Missing environment validation, input validation, and error code differentiation mean the API is brittle in production:
- Server crashes silently if config is wrong (Finding #3)
- Malformed card data is sent to billing provider instead of rejected (Finding #4)
- Caller cannot distinguish whether to retry, fail permanently, or ask user to resubmit (Finding #5)

**Data Integrity (Finding #6):** Correlation ID collisions under load will make production debugging impossible when multiple requests arrive in the same millisecond.

### Priority Order

1. **Fix data logging (Findings #1, #2)** — Remove card details, headers, and full request body from logs. Replace with method, path, correlation ID only. ~15 min fix, unblocks compliance review.

2. **Add environment validation (Finding #3)** — Validate `BILLING_API` and `BILLING_KEY` on module load (before `listen()`). Return clear startup error if missing. ~5 min fix, eliminates silent failures.

3. **Implement input validation (Finding #4)** — Add schema validation for required fields before sending to billing API. Return 400 with field errors on validation fail. ~30–45 min fix (depends on schema library choice), prevents downstream provider errors.

4. **Differentiate error responses (Finding #5)** — Parse billing provider response status and return appropriate 400/502/503. ~15 min fix, enables client retry logic.

5. **Replace correlation ID generation (Finding #6)** — Switch to `crypto.randomUUID()` to eliminate collisions. ~5 min fix, improves observability.

6. **Address secondary concerns (Findings #7–10)** — Schema validation library adoption, middleware error handling, SSRF mitigation, request size limits. These improve resilience and maintainability but are lower severity.

### Coverage Gaps

- **Dependency audit:** `npm audit` could not be run in this environment. Express 4.19.0 and any transitive dependencies are not verified for known vulnerabilities.
- **Type checking:** No TypeScript or JSDoc type annotations; type errors only surface at runtime.
- **Integration testing:** Only unit test for logging module; no tests for the `/subscriptions` endpoint (request/response flow, error scenarios, edge cases).
- **Load testing:** No throughput, latency, or correlation ID uniqueness testing under realistic load.
- **Security testing:** No authentication/authorization testing for the billing provider key; no testing of SSRF, injection, or replay attacks.
- **Production metrics:** No information on actual traffic volume, error rates, or billing provider response times. Priority order may shift if traffic exceeds 1000 req/sec.
