# Subscriptions API Assessment

## Overview
The API is a minimal Express server that proxies subscription creation requests to an external billing provider. The implementation is small and functional but has significant gaps in security, validation, and testing.

## Strengths

1. **Structured logging**: JSON-formatted logs with correlation IDs enable end-to-end request tracing.
2. **Minimal implementation**: The code is concise and straightforward, following the principle of smallest coherent implementation.
3. **Error containment**: Generic error response (502) hides details from clients, reducing information disclosure.
4. **Separation of concerns**: Logging, billing, and server logic are modularized.

## Critical Issues

### 1. No Input Validation (Trust Boundary)
The endpoint accepts `POST /subscriptions` with sensitive card data but performs **zero validation**:
- Email format not validated
- Card number format not checked (expecting 16 digits, but anything is accepted)
- Expiry date not validated (format, future date)
- CVC not validated (expecting 3–4 digits)
- Date of birth not validated (format, age check)

**Risk**: Invalid data propagates to billing provider; billing provider errors are the only validation mechanism. Attackers can send garbage or probe API behavior.

**Policy gap**: "Validate inputs and authorization at trust boundaries" — this endpoint is a trust boundary and validates nothing.

### 2. No Authentication / Authorization
`POST /subscriptions` is completely open. Any client can create subscriptions without proof of user identity or intent.

**Risk**: Unauthorized subscription creation, spam, fraud, resource abuse.

**Unknowns**: 
- Should only authenticated users create subscriptions?
- Should there be a user ID in the request or derived from auth headers?
- Are subscriptions tied to user accounts?

### 3. Sensitive Data Handling
The full request payload (including card number, CVC, DOB) is logged to stdout:
```
"body": { "email": "...", "cardNumber": "1234567890123456", "cvc": "123", ... }
```

**Risk**: Sensitive card data may be captured in logs, violating PCI DSS and exposing data in log aggregation systems.

**Better**: Hash or omit sensitive fields in logs. Log only cardholder name and card last 4 digits.

### 4. No Error Retries
External API calls have no retry logic. A transient failure (network hiccup, provider timeout) causes immediate client failure.

**Risk**: Intermittent failures degrade user experience unnecessarily.

**Policy gap**: "Run the product, tests, and build before claiming completion" — real deployment would expose this with transient failures.

### 5. Minimal Test Coverage
Only one test exists (logging). The main endpoint (`POST /subscriptions`) and error paths have **zero tests**.

**Missing**:
- Happy-path test: valid input → subscription created
- Invalid input tests: malformed email, bad card number, etc.
- Error propagation: billing API returns 400/500 → correct client response
- Authorization tests: unauthenticated request rejection

**Policy gap**: "Add focused automated tests for critical behavior and failure paths" — not done for the main feature.

### 6. Material Unknowns Not Clarified

The code assumes but doesn't document:
- **User identity**: How is the subscription linked to a user? No user ID in payload.
- **Data ownership**: Can a user only create their own subscriptions, or any subscription?
- **Rate limiting**: Should there be per-user or per-IP limits?
- **Idempotency**: If a client retries the same request, should it create duplicate subscriptions?
- **Billing API contract**: What payload format, error codes, and retry behavior?
- **PCI scope**: Is this service in PCI compliance scope? Should card data touch this API at all?

**Policy gap**: "Clarify material unknowns before committing to architecture or UX" — several unknowns are implicit in the design.

## Moderate Issues

### 7. Generic Error Response Lacks Debugging Context
Clients receive `{ error: 'could not create subscription' }` on all failures, even for validation errors. This is good for security but makes debugging hard for legitimate clients.

**Better**: Structured error response with error code, e.g., `{ code: 'INVALID_EMAIL', message: 'Email format invalid' }`.

### 8. No Rate Limiting or Abuse Prevention
Nothing prevents a client from flooding the server with requests.

**Risk**: DoS, accidental or malicious.

### 9. Bearer Token in Environment Variable
The billing API key (`BILLING_KEY`) is read from an environment variable but never validated to exist or be non-empty.

**Risk**: Silent failure if configuration is missing; API calls fail silently with auth errors.

## Deployment Readiness

**Verified**:
- ✅ Tests pass (`npm test`)
- ✅ No syntax errors
- ✅ Logging mechanism works
- ⚠️ API can start (not tested; would need `BILLING_API` and `BILLING_KEY` env vars set)

**Not verified**:
- ❌ Actual subscription creation (requires mock/test billing service)
- ❌ Error paths (network failure, billing API error)
- ❌ Load behavior under concurrent requests

## Backwards Compatibility

No versioning or data contract documented. The API assumes a single fixed payload schema; changes to fields or types would break existing clients with no migration path.

## Recommendations (Priority Order)

1. **Add input validation** for all fields at the endpoint. Fail fast with specific error codes.
2. **Add authentication** (user ID or token) to identify the requestor. Ensure a user can only create their own subscriptions.
3. **Remove sensitive fields from logs** or use a structured logging middleware to filter them.
4. **Write integration tests** for the main endpoint: valid input, invalid input, billing API errors.
5. **Clarify and document** the user identity model, idempotency semantics, and rate limiting strategy.
6. **Add retry logic** for transient failures (configurable backoff).
7. **Add rate limiting** (e.g., per-user, per-IP).
8. **Validate env vars** at startup (fail if `BILLING_API` or `BILLING_KEY` missing).
9. **Return structured error responses** with error codes for easier debugging.
10. **Document PCI compliance** approach (e.g., whether card data should be tokenized client-side).

## Summary

The API implements a working proxy to a billing provider but lacks foundational production-readiness:
- **No input validation at the trust boundary**
- **No authentication/authorization**
- **Sensitive data logged unmasked**
- **No error retries**
- **Minimal test coverage**

The code satisfies "smallest coherent implementation" structurally but violates the engineering policy on validation at trust boundaries, test coverage, and clarifying unknowns. Before deployment, validation, authentication, and test coverage are non-negotiable. The sensitive data logging issue requires immediate attention.

**Remaining Uncertainty**: User identity model, PCI compliance scope, and billing API contract details are not documented or enforced in code.
