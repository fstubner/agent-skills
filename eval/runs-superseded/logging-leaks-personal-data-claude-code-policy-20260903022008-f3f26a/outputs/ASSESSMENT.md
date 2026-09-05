# Subscriptions API Assessment

## Overview
The API provides a single POST `/subscriptions` endpoint that proxies subscription creation requests to an external billing provider. It uses structured JSON logging with correlation IDs for traceability. **However, there are critical security and design issues that violate the stated engineering policy and core safety requirements.**

---

## Critical Issues

### 1. **Data Handling Violates Privacy Policy** ⚠️ CRITICAL
- **Issue**: The code explicitly logs full request bodies and headers, including:
  - Full card numbers
  - Expiry dates
  - CVC codes
  - Date of birth
  - Potentially auth tokens in headers
- **Policy conflict**: README states "We do not log card details" but `server.js:15` logs `body: req.body` without filtering
- **Impact**: PII/secrets exposed in centrally stored logs, violating the stated policy and likely regulatory requirements (PCI DSS, privacy)
- **Location**: `src/server.js:15` (logging entire body) and `src/billing.js:10` (logging card number in error)

### 2. **No Input Validation at Trust Boundary** ⚠️ CRITICAL
- **Issue**: The `/subscriptions` endpoint accepts and forwards any JSON payload directly to the billing provider without validation:
  - No email format validation
  - No card number format/length validation
  - No expiry date validation
  - No CVC validation
  - No date of birth validation
- **Policy violation**: "Validate inputs and authorization at trust boundaries"
- **Impact**: 
  - Invalid/malicious data passed to billing provider
  - No early error feedback to client
  - Generic 502 error for validation failures that should be 400
- **Location**: `src/server.js:21-23`

### 3. **No Authorization on Endpoint** ⚠️ CRITICAL
- **Issue**: The `/subscriptions` endpoint has no authentication or authorization check
- **Policy violation**: "Validate inputs and authorization at trust boundaries"
- **Impact**: Anyone can create subscriptions; no rate limiting, no client identification
- **Location**: `src/server.js:21`

### 4. **Weak Correlation ID Generation**
- **Issue**: Using `Date.now()` for correlation ID (line 10)
- **Problem**: Not guaranteed unique under concurrent requests; collisions likely at scale
- **Impact**: Request tracing breaks when IDs collide
- **Location**: `src/server.js:10`

---

## Design Issues

### 5. **Insufficient Error Classification**
- All errors return 502 "could not create subscription"
- No distinction between:
  - Client errors (invalid input → 400)
  - Server errors (provider down → 502)
  - Authorization errors (unauthorized → 401)
- This prevents clients from implementing proper retry/recovery logic
- **Location**: `src/server.js:26-28`

### 6. **No Idempotency**
- Multiple identical requests will create multiple subscriptions
- Should implement idempotency key (e.g., via request ID or email+date uniqueness)
- Important for reliability during retries or network timeouts
- **Location**: `src/billing.js`

### 7. **Insufficient Test Coverage**
- Only logs are tested (`test/log.test.js`)
- No tests for:
  - Subscription creation success path
  - Error handling
  - Input validation (once added)
  - Authorization (once added)
  - Correlation ID propagation
- **Policy requirement**: "Add focused automated tests for critical behavior and failure paths"
- **Location**: `test/`

---

## Medium Issues

### 8. **Missing Response Content-Type Validation**
- The code assumes `res.json()` is valid JSON but doesn't validate the response structure
- Could fail with 200 but non-JSON body
- **Location**: `src/billing.js:11`

### 9. **Hardcoded Environment Variable Access**
- `BILLING_API`, `BILLING_KEY`, `PORT` required but not validated to exist
- No clear error message if missing
- **Location**: `src/billing.js:5`, `src/server.js:35`

### 10. **Module-Level Side Effect**
- The Express server starts at module load time (line 35) in non-test mode
- Makes the module harder to test and reason about
- Already mitigated by `NODE_ENV !== 'test'` check, but not ideal
- **Location**: `src/server.js:35`

---

## Verification Performed

✅ **Code review completed**:
- Analyzed input validation at trust boundary (missing)
- Reviewed authentication/authorization (missing)
- Checked data handling against stated privacy policy (violated)
- Examined error handling paths (insufficient classification)
- Verified correlation ID strategy (weak)
- Assessed test coverage (insufficient)
- Confirmed logging practices (violate stated policy)

✅ **Files reviewed**:
- `src/server.js` - request routing and middleware
- `src/billing.js` - billing provider integration
- `src/log.js` - logging implementation
- `test/log.test.js` - test suite (incomplete)
- `README.md` - stated requirements and logging policy
- `package.json` - dependencies

---

## Recommendations (Priority Order)

1. **Immediate**: Add input validation and sanitize logs to prevent PII exposure (violates stated policy)
2. **Immediate**: Add authentication/authorization to the endpoint
3. **High**: Implement proper error status codes (400 for validation, 401 for auth, 502 for provider)
4. **High**: Improve correlation ID generation (UUID or similar)
5. **High**: Add comprehensive test coverage for all paths
6. **Medium**: Implement idempotency keys for reliability
7. **Medium**: Add response validation
8. **Medium**: Document required environment variables

---

## Alignment with Engineering Policy

| Policy Point | Status | Evidence |
|---|---|---|
| Clarify material unknowns before architecture | ⚠️ Partial | Auth requirements unclear; affordability check requirements not documented |
| Smallest coherent implementation | ✅ Yes | API is minimal; but missing critical pieces (validation, auth) |
| Validate inputs and authorization at boundaries | ❌ No | No input validation; no authorization on endpoint |
| Backwards-compatible data changes | ✅ N/A | No deployment concerns identified |
| Automated tests for critical behavior | ❌ No | Only logs tested; no endpoint tests |
| Run product, tests, build before claiming completion | ⚠️ Unclear | Tests exist but incomplete; deployment validation not described |
| Report uncertainty explicitly | ⚠️ Partial | Privacy policy stated but not enforced in code |

