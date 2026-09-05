# Subscriptions API Assessment

## Summary
The Subscriptions API creates payment subscriptions with an external billing provider. While the basic structure is sound, there are **critical security issues** with sensitive data handling and **significant gaps** in input validation, authorization, error handling, and test coverage.

## Critical Security Issues

### 1. Card Details Logged in Request Body (server.js:15)
**Severity**: CRITICAL  
**Issue**: The request middleware logs the entire request body, including full card numbers, expiry dates, and CVC codes. This violates the documented requirement: "We do not log card details."
- Line 15: `body: req.body` logs everything the client sends
- This happens before validation, so invalid or malicious payloads are also logged
- Logs are retained for 2 years in a centralized store, creating a long-lived attack surface
- **Impact**: PCI DSS violation, regulatory compliance failure, data breach risk

### 2. Sensitive Data in Error Logs (server.js:27, billing.js:10)
**Severity**: CRITICAL  
**Issue**: The error handler logs the request payload, which includes full card details.
- Line 27: `payload: req.body` in error context exposes all sensitive data when billing fails
- Line 10 (billing.js): Error message includes last 4 digits of card, which leaks to logs
- **Impact**: Sensitive authentication/card data in error logs retained for 2 years

### 3. Correlation ID Weakness (server.js:10)
**Severity**: MEDIUM  
**Issue**: Using `Date.now()` for correlation ID is not unique if multiple requests arrive in the same millisecond.
- Not cryptographically random or guaranteed unique
- Better: UUID v4 or combination of timestamp + counter + random bytes

### 4. Headers Logged (server.js:16)
**Severity**: HIGH  
**Issue**: Logging all headers could expose authorization tokens, API keys, or other sensitive metadata.
- Should filter headers: omit `authorization`, `x-api-key`, `cookie`, etc.

## Input Validation & Authorization Gaps

### 5. No Input Validation (billing.js:4-12)
**Severity**: HIGH  
**Issue**: No validation of required fields or types before sending to billing provider.
- Payload passed directly to external API without checks
- No validation of email format, card number format, date of birth, etc.
- Any malformed data reaches the billing provider, causing confusing errors
- No way to reject clearly invalid data before external call

### 6. No Authorization (server.js:21-30)
**Severity**: HIGH  
**Issue**: `/subscriptions` POST endpoint has no authentication or authorization check.
- Anyone can create subscriptions without credentials
- No rate limiting, no API key validation, no JWT/session check
- **Impact**: Can create fraudulent subscriptions, abuse the service, waste provider costs

## Error Handling

### 7. Imprecise Error Responses (server.js:28)
**Severity**: MEDIUM  
**Issue**: All errors return `502 "could not create subscription"` regardless of cause.
- Client cannot distinguish between:
  - Invalid request (missing fields, bad format) → should be 400
  - Authorization failure → should be 401/403
  - Billing provider error (500) → should be 502
  - Network timeout → should be 504
- Makes debugging harder for API consumers
- Loses information about failure root cause in response

### 8. Error Swallowing (server.js:26-29)
**Severity**: MEDIUM  
**Issue**: Broad `catch (error)` swallows all exceptions without classification.
- Network errors, timeouts, JSON parse errors all treated identically
- No distinction between client error (fix payload) vs provider error (retry later)
- Error details logged but response is generic

## Test Coverage

### 9. Insufficient Test Coverage
**Severity**: MEDIUM  
**Issue**: Only 1 test exists for the logging utility; no tests for:
- POST `/subscriptions` endpoint (happy path, auth failure, validation failure)
- `createSubscription()` function (provider success, provider error, network error)
- Error logging behavior
- Correlation ID generation
- No test verifies that sensitive data is NOT logged

**Current state**: `test/log.test.js` tests only that log output is valid JSON. No test of main API logic.

## Architectural Observations

### 10. Backwards Compatibility
- Current API is not versioned; changes break all clients
- No schema versioning strategy for billing provider integration
- Suggested: Add `/v1/subscriptions` path, migrate clients over time

### 11. Observability
- **Positive**: Structured logging with correlation ID enables request tracing
- **Gap**: No metrics (latency, success rate, billing provider error rates)
- **Gap**: No health check endpoint for monitoring

### 12. Dependencies
- Single dependency: `express@^4.19.0` (reasonable)
- `node:test` and `node:assert` used from Node.js standard library (Node 18+)
- No validation library (could add for input checking)

## Code Quality

### 13. Environment Variable Handling
- `BILLING_API` and `BILLING_KEY` not validated on startup
- If missing, errors occur at request time, not startup time
- Should validate required env vars at server startup

### 14. Payload Forwarding
- Directly forwarding client payload to billing provider is fragile
- No schema validation, field filtering, or normalization
- If billing provider API changes, no layer of defense
- If new security requirements emerge (PII filtering), requires code changes

## Recommendations (Priority Order)

1. **IMMEDIATE**: Remove sensitive data from logs
   - Filter request body in middleware (omit card fields)
   - Filter error payload logging
   - Filter headers (remove authorization)
   - Remove card number from billing.js error message

2. **IMMEDIATE**: Add authorization
   - Require API key or Bearer token
   - Validate on every request

3. **HIGH**: Add input validation
   - Validate required fields present
   - Validate field types and formats
   - Reject invalid requests with 400 before calling provider

4. **HIGH**: Improve error responses
   - Return 400 for validation errors
   - Return 401/403 for auth failures
   - Return 502 only for provider errors
   - Include error code (not full message) for debugging

5. **MEDIUM**: Add tests
   - Test happy path (POST with valid data)
   - Test auth failure (missing/invalid key)
   - Test validation failure (missing fields, bad email)
   - Test provider errors
   - Verify sensitive data is NOT in logs

6. **MEDIUM**: Use UUID for correlation IDs

7. **MEDIUM**: Validate environment variables at startup

## Test Results
- Existing test suite: **PASS** (1/1 tests pass)
- Coverage: Only logging utility tested, main API untested

---

## Verification Summary
✓ Code reviewed: server.js, billing.js, log.js, package.json  
✓ Tests executed: 1 test passes  
✓ Security issues identified: 4 critical (card logging, auth missing, error exposure, headers)  
✓ Coverage gaps identified: No tests for main POST endpoint or createSubscription()  
✓ Policy alignment checked: Input validation missing at trust boundary, authorization missing at trust boundary, no error handling strategy for provider failures  

**Material unknowns**: 
- What fields does the billing provider require? (affects validation strategy)
- Should correlation IDs be user-provided or server-generated? (affects uniqueness guarantees)
- Are there existing auth mechanisms in the deployment? (affects auth implementation)
