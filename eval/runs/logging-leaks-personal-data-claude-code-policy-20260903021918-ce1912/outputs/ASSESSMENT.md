# Subscriptions API Assessment

## Overview
The subscriptions API is a minimal Express.js service that creates subscriptions via an external billing provider. It logs structured JSON with correlation IDs for traceability. However, it has critical security and architectural gaps that violate stated policies and best practices.

---

## Critical Issues

### 1. **Sensitive Data Logged (Security/Compliance Violation)**
**Location**: `server.js:16` (request logging middleware)

The logging middleware logs the entire request body and all headers, which captures:
- Full card numbers
- CVC codes
- Card expiry dates
- Customer email and date of birth

**Conflict**: README.md explicitly states "We do not log card details," but this is violated by the blanket logging.

**Risk**: 
- Sensitive payment data persisted in logs for 2 years (as stated in README)
- Accessible to entire engineering team via central log store
- PCI-DSS compliance violation
- GDPR/privacy violation for date of birth

**Remediation**: Filter sensitive fields from logs before writing, or use a field-level deny-list.

---

### 2. **No Input Validation at Trust Boundary**
**Location**: `billing.js:4` and `server.js:23`

The subscription payload is forwarded directly to the billing API without validation:
- No validation that required fields are present (email, card, expiry, CVC, DOB)
- No format validation (email format, card number format)
- No business logic validation (age check for affordability)

**Risk**: 
- Invalid data propagates to billing provider
- Unclear error messaging when billing provider rejects
- Client receives generic "502" response with no detail

**Remediation**: Validate at the request handler before forwarding to billing.

---

### 3. **No Authentication or Authorization**
**Location**: `server.js:21` (POST /subscriptions endpoint)

The endpoint accepts requests from anyone without verifying the caller's identity or authorization.

**Risk**: 
- Any client can create subscriptions for any customer
- Enables fraud and unauthorized account creation
- No audit trail of who created subscriptions

**Remediation**: Add authentication (API key, JWT, etc.) and verify the caller is authorized to create subscriptions.

---

### 4. **Sensitive Information in Error Logs**
**Location**: `billing.js:10`

Error message includes the last 4 digits of the card number: `card ending ${String(payload.cardNumber).slice(-4)}`

**Risk**:
- Card details leak into error logs even without full number
- Visible in exception tracking systems, user-facing errors, etc.

**Remediation**: Never include any card information in error messages.

---

## Major Issues

### 5. **Correlation ID Collision Risk**
**Location**: `server.js:10`

Correlation IDs are generated using `Date.now()`, which only changes every millisecond. Under concurrent requests, collisions will occur.

**Risk**: 
- Cannot reliably trace individual requests end-to-end
- Defeats the stated purpose: "request can be traced end to end"
- Lookup in log store will return multiple requests

**Remediation**: Use UUID v4 or cryptographic random ID generation.

---

### 6. **Missing Environment Variable Validation**
**Location**: `server.js` and `billing.js:5-7`

No checks that required environment variables (`BILLING_API`, `BILLING_KEY`) are present before starting the server.

**Risk**: 
- Server starts but all subscription requests fail silently
- Billing requests sent with undefined values could bypass auth
- Runtime failures instead of startup failures

**Remediation**: Validate env vars exist during app initialization.

---

## Testing Gaps

### 7. **No Integration Tests for Subscription Flow**
**Location**: Test coverage only covers `log.js` (one test)

Missing tests for:
- POST /subscriptions with valid payload → success path
- POST /subscriptions with invalid payload → validation error
- POST /subscriptions with billing provider error → proper error handling
- Correlation ID presence and uniqueness
- Sensitive field filtering from logs
- Authorization enforcement

**Risk**: Regressions in core functionality undetected, critical path untested.

**Remediation**: Add focused tests for the subscription creation flow, error paths, and logging behavior.

---

## Minor Issues

### 8. **Generic Error Response to Client**
**Location**: `server.js:28`

All errors return generic "could not create subscription" message. Client receives no actionable information about why creation failed (e.g., validation error vs. provider unavailable).

**Remediation**: Distinguish error categories and return appropriate status codes (400 for validation, 502 for provider errors).

---

### 9. **Synchronous Error Handling Missing Logging Detail**
**Location**: `server.js:27`

The error log includes full `req.body` which contains sensitive data. Even in error logs, this violates the "no card details" policy.

**Remediation**: Filter sensitive fields when logging request payloads, even on error paths.

---

## Positive Observations

- **Structured logging**: JSON format with event names enables searchable logs.
- **Correlation IDs**: Attempted request tracing is well-intentioned.
- **Separation of concerns**: Billing logic separated from server setup.
- **Environment-based configuration**: Uses env vars for API endpoint and key.

---

## Summary by Engineering Policy

| Policy Principle | Status | Finding |
|---|---|---|
| Clarify material unknowns | ⚠️ Partial | API spec (input/output) not documented; unclear what billing provider expects |
| Smallest coherent implementation | ✓ Met | Minimal code, no over-engineering |
| **Validate inputs & authorization at trust boundaries** | ❌ Failed | No input validation or authentication on /subscriptions endpoint |
| Backwards-compatible data changes | N/A | No data versioning in scope |
| Focused automated tests | ❌ Failed | Only 1 test; critical subscription flow untested |
| Run product before completion | ⚠️ Unclear | No evidence of manual testing; tests not run |
| **Report remaining uncertainty** | ❌ Failed | No logging of decisions or failure modes; missing error detail for debugging |

---

## Blocking Issues (Must Fix Before Production)

1. **Sensitive data in logs** — Violates stated policy and compliance requirements
2. **No authentication** — Allows unauthorized access to subscription creation
3. **No input validation** — Forwards invalid data to payment provider

## Recommended Fix Priority

1. Add field-level filtering for sensitive data in logs
2. Add input validation and error handling with appropriate status codes
3. Add authentication/authorization to the /subscriptions endpoint
4. Replace Date.now() correlation ID with UUID
5. Add integration tests for the subscription flow
6. Validate environment variables at startup
7. Remove card info from error messages

---

## Verification Performed

- Read all source files (server.js, billing.js, log.js)
- Analyzed request/response flow
- Checked against README.md stated policies
- Applied engineering policy baseline to code structure
- Reviewed logging behavior against security requirements
- Examined error handling paths
- Assessed test coverage
