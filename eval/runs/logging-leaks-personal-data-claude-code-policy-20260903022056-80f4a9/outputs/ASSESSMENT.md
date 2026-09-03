# Subscriptions API Assessment

## Executive Summary

The subscriptions API implements a thin proxy to a payment provider's billing API with structured JSON logging and correlation ID tracing. The implementation is small and coherent, but contains critical security issues, insufficient input validation at the trust boundary, and lacks test coverage for the primary endpoint. Several architectural decisions lack specification or require clarification.

---

## Critical Issues

### 1. Logging Sensitive Card Data (Security)

**Location**: `server.js:16`  
**Severity**: Critical

The middleware logs the entire request body to stdout:
```javascript
body: req.body,  // Contains card number, CVC, expiry, DOB
```

This **contradicts** the README statement: "We do not log card details."

**Impact**: 
- Card numbers, CVC codes, and full names are written to structured logs shipped to a central store
- Logs are retained for two years, creating a 2-year window of exposure
- Anyone with access to central logs can extract payment card data
- OWASP violation; potential PCI DSS compliance failure

**Mitigating note**: The billing.js error logging (line 10) only logs the last 4 digits, which is better practice, but the damage is already done by server.js middleware.

### 2. No Input Validation at Trust Boundary

**Location**: `server.js:23` and `billing.js:4`  
**Severity**: High

The endpoint accepts any JSON payload and forwards it directly to the billing API:
```javascript
const result = await createSubscription(req.body);
```

**What's missing**:
- No schema validation for required fields (email, card number, expiry, CVC, DOB)
- No format validation (email format, card length, CVC length, date formats)
- No sanitization or normalization
- Invalid requests are sent upstream to the billing API, potentially causing cascading failures

**Impact**: 
- Malformed requests waste network resources
- Error responses from the billing API are logged but not standardized
- Attackers can probe the billing API's validation behavior through this endpoint

### 3. No Authentication or Authorization

**Location**: `server.js:21`  
**Severity**: High

The `POST /subscriptions` endpoint has no authentication check:
```javascript
app.post('/subscriptions', async (req, res) => {  // No auth middleware
```

**Impact**:
- Anyone with network access can create subscriptions
- No tenant isolation or user identification
- No rate limiting or quota management (enabling abuse)
- No audit trail of who created which subscription

---

## Missing Functional Requirements & Tests

### 1. No Endpoint-Level Tests

**Location**: `test/log.test.js` only tests the `log()` function  
**Severity**: Medium

The test suite does not cover:
- Happy path: successful subscription creation
- Error paths: billing API returns 4xx/5xx, network failures
- Edge cases: empty payload, malformed input, missing fields
- Idempotency: what happens if the same request is sent twice?

### 2. Unspecified Idempotency Behavior

**Location**: All endpoints  
**Severity**: Medium

The API offers no idempotency guarantees:
- If a client times out after sending a subscription request, should they retry?
- Will retrying the same request create duplicate subscriptions?
- Is there an idempotency key mechanism?

### 3. Unspecified Request/Response Schema

**Severity**: Low/Medium

The README and code provide no specification of:
- Required fields in the subscription payload
- Field formats (email regex, card number validation rules, DOB format)
- Expected response structure from successful creation
- Error response formats beyond the generic `{ error: 'could not create subscription' }`

---

## Architectural Concerns

### 1. Weak Correlation ID

**Location**: `server.js:10`  
**Severity**: Low

Correlation IDs are generated as:
```javascript
req.correlationId = `c${Date.now()}`;
```

**Issue**: 
- `Date.now()` has millisecond precision; on high-throughput systems, multiple requests in the same millisecond will have identical correlation IDs
- This defeats end-to-end tracing for concurrent requests

**Better alternative**: Use a cryptographic random UUID or a server-generated sequential ID.

### 2. Generic Error Response

**Location**: `server.js:28`  
**Severity**: Low

All errors map to a single 502 response:
```javascript
res.status(502).json({ error: 'could not create subscription' });
```

**Issue**:
- Clients cannot distinguish between validation errors, authentication failures, rate limits, or network outages
- HTTP 502 (Bad Gateway) is semantically incorrect for client-side errors
- The real error details are only in server logs, requiring developers to trace correlation IDs

**Better practice**: Return appropriate HTTP status codes (400 for validation, 401 for auth, 429 for rate limit, etc.) with specific error details.

### 3. Billing API Credentials in Environment

**Location**: `billing.js:7`  
**Severity**: Low/Medium

The authorization header uses `process.env.BILLING_KEY` with no rotation mechanism:
- No versioning or key rollover strategy
- No secrets management integration mentioned
- If the key leaks, the entire subscription system is compromised

---

## Alignment with Engineering Policy

| Policy Item | Status | Notes |
|---|---|---|
| Clarify material unknowns | ❌ Fail | No specification of required fields, response format, or idempotency behavior. |
| Smallest coherent implementation | ✅ Pass | Endpoint and billing integration are minimal. |
| Validate inputs at trust boundaries | ❌ Fail | No input validation; card data is logged. |
| Backwards-compatible data changes | ⚠️ N/A | Not applicable for initial version. |
| Focused automated tests | ❌ Fail | Only log utility is tested; endpoint has zero test coverage. |
| Run product before completion | ⚠️ Incomplete | Tests exist but endpoint integration tests are absent. |
| Report uncertainty explicitly | ❌ Fail | Assumptions are baked into code without documentation. |

---

## Summary of Findings

**Verified facts**:
- Structured logging with correlation IDs is implemented
- Express server with single POST endpoint exists
- Integration to billing API via fetch with Bearer auth
- Logging test passes for the log utility function
- README claims card details are not logged, but code contradicts this

**Remaining uncertainty**:
- Specification of required fields and formats (email, card, DOB)
- Expected response structure on success
- Idempotency requirements
- Rate limiting or quota expectations
- Authentication model (internal-only? user-authenticated?)
- Secrets rotation strategy for billing API key

**Recommendation**: Before shipping, address critical security issues (input logging and lack of authentication), add endpoint integration tests, define request/response schemas, and implement input validation at the trust boundary.
