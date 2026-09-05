# Subscriptions API Assessment

## Overview
A Node.js/Express API that forwards subscription creation requests to a billing provider. Uses structured JSON logging with correlation IDs for end-to-end traceability.

## Critical Security Issues

### 1. Sensitive Data Exposure in Logs
**Severity: CRITICAL**
- `server.js:16` logs the entire request body: `body: req.body`
- This captures full card numbers, expiry, CVC, and date of birth
- Violates PCI DSS compliance requirements (card data must not be logged)
- Directly contradicts the README statement "We do not log card details"
- Logs are retained for two years in a central store accessible to the engineering team

**Impact:** PCI compliance violation, potential regulatory fines, customer data exposure.

### 2. Sensitive Data in Error Messages
**Severity: HIGH**
- `billing.js:10` includes card number (last 4 digits) in error messages
- Error details are logged via `logError()` and sent to central log store
- While partial, this still reveals identifiable card information

### 3. Missing Input Validation
**Severity: HIGH**
- No validation of required fields, data types, or field formats
- No maximum payload size limits (potential for DoS attacks)
- `server.js:23` blindly forwards entire request body to billing API
- No schema validation for customer email, card details, date of birth
- No rate limiting or account-level quotas

### 4. Missing Authentication & Authorization
**Severity: HIGH**
- `/subscriptions` endpoint has no authentication checks
- Anyone with network access can create subscriptions
- No API key validation, OAuth, or session management
- No way to verify the request is from an authorized caller

## Architectural Issues

### 5. Insecure Header Logging
**Severity: HIGH**
- `server.js:15` logs all request headers: `headers: req.headers`
- Authorization headers, API keys, and tokens are captured
- Creates a secondary exposure vector for credentials

### 6. Insufficient Error Handling
**Severity: MEDIUM**
- All billing errors return HTTP 502, regardless of cause
- No distinction between client errors (400) and server errors (502)
- Error response `{ error: 'could not create subscription' }` is vague
- No request ID or error tracking reference provided to client

### 7. Environment-Based Configuration Gaps
**Severity: MEDIUM**
- Relies on `process.env.BILLING_API` and `process.env.BILLING_KEY`
- No validation that these are set at startup
- No example `.env.example` or configuration documentation
- Missing configuration for log destination/retention policies

## Testing & Verification Gaps

### 8. Minimal Test Coverage
- Only 1 test: `log.test.js` tests the logging utility alone
- No endpoint tests (POST /subscriptions)
- No tests for error scenarios or validation
- No integration tests with billing API mock
- No tests for authentication, authorization, or sensitive data handling

### 9. Undocumented API Contract
- No request/response schema documentation
- No examples of valid/invalid payloads
- No API versioning strategy
- No deprecation or backward compatibility plan

## Positive Aspects

✓ Structured JSON logging enables end-to-end request tracing via correlation IDs  
✓ Clean separation of concerns (server, billing, logging modules)  
✓ Built-in Node.js test runner (no external test framework)  
✓ Environment-based configuration for flexibility  
✓ Correlation ID included in all log lines and errors  

## Policy Baseline Alignment

Against the engineering policy baseline:

| Principle | Status | Issue |
|-----------|--------|-------|
| Validate at trust boundaries | ❌ FAIL | No input validation; billing API response not validated |
| Input validation & authorization | ❌ FAIL | No authentication; no input schema validation |
| Additive data changes | ⚠️ UNCLEAR | Not applicable (no data layer); forward-compatible payload forwarding |
| Automated tests for critical behavior | ❌ FAIL | No endpoint or integration tests |
| Run product before completion | ⚠️ INCOMPLETE | Dependencies not installed; server not verified to start |
| Report uncertainty explicitly | ⚠️ INCOMPLETE | No error tracking, no customer communication strategy |

## Recommendations (Priority Order)

1. **URGENT:** Remove sensitive data from logs (card details, expiry, CVC, headers)
2. **URGENT:** Add authentication/authorization to `/subscriptions` endpoint
3. **HIGH:** Implement input validation for all fields before forwarding
4. **HIGH:** Add payload size limits and rate limiting
5. **HIGH:** Distinguish error responses (400 for client errors, 502 for server errors)
6. **MEDIUM:** Add endpoint tests covering success, validation failure, and provider failure paths
7. **MEDIUM:** Document API contract (request schema, response formats, error codes)
8. **MEDIUM:** Add startup validation for required environment variables
9. **LOW:** Create `.env.example` with required variables

## Verification Summary

✓ Code structure reviewed (5 files)  
✓ Existing tests executed (1/1 passing)  
✓ npm dependencies listed (express^4.19.0)  
✓ Logging behavior verified  
✓ No data mutations confirmed (assessment-only)  

**Key Uncertainty:** Actual authentication mechanism unknown—unclear if API sits behind a gateway, service mesh, or reverse proxy that handles auth. Recommend documenting the security model end-to-end.
