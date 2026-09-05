# Subscriptions API Assessment

## Summary
The Subscriptions API is a Node.js/Express service that creates subscriptions with a payment provider. While the basic structure is sound, there are several critical security, reliability, and operational concerns.

## Critical Issues

### 1. **Security: Sensitive Data Logging Violation**
**Severity: Critical**

The API logs sensitive customer data in direct contradiction to the documented policy "We do not log card details."

**Locations:**
- `server.js:15` - Logs entire `req.body` which contains card number, expiry, CVC, and date of birth
- `server.js:16` - Logs `req.headers` which may contain sensitive authentication credentials
- `server.js:27` - Logs `payload: req.body` in error handler, exposing sensitive data on failures
- `billing.js:10` - Error message includes card number suffix (`String(payload.cardNumber).slice(-4)`), violating the no-logging-card-details policy

**Impact:** Sensitive payment card data and personally identifiable information (DOB) are written to logs that ship to central storage for 2 years, potentially exposing customer data through log access, breaches, or accidental disclosure.

**Recommendation:** Remove sensitive fields from logging. Log only non-sensitive identifiers (e.g., masked customer ID or email hash) and redact card/DOB fields entirely.

### 2. **Reliability: Weak Correlation ID Generation**
**Severity: High**

`server.js:10` uses `'c${Date.now()}'` as the correlation ID.

**Problems:**
- Under high concurrency, multiple requests in the same millisecond will generate identical correlation IDs
- Makes end-to-end tracing unreliable for request correlation
- Defeats the purpose of structured logging for diagnostics

**Recommendation:** Use UUID v4 or nanoid for unique correlation IDs per request.

## High-Priority Issues

### 3. **Security: Lack of Input Validation**
**Severity: High**

The POST endpoint accepts arbitrary payloads and passes them directly to the billing provider without validation.

**Problems:**
- No schema validation of required fields (email, cardNumber, expiry, cvc, dateOfBirth)
- No data type validation
- Invalid or malicious payloads silently pass through to the billing API
- Errors from billing API are caught but validation errors at this layer would be preferable

**Recommendation:** Add request schema validation using a library like zod or joi. Validate that required fields exist and have correct types before calling the billing service.

### 4. **Security: Missing API Authentication/Authorization**
**Severity: High**

No authentication or authorization on the `/subscriptions` endpoint.

**Problems:**
- Any caller can create subscriptions without authentication
- No rate limiting or abuse prevention
- No audit trail of who triggered subscription creation
- In a production system, this endpoint should require valid API keys or JWT tokens

**Recommendation:** Implement authentication (e.g., Bearer token validation) and consider rate limiting per authenticated client.

### 5. **Error Handling: Unhandled JSON Parse Errors**
**Severity: Medium**

Express.json() middleware may fail to parse invalid JSON, but error handling isn't explicitly defined.

**Problems:**
- Malformed JSON will result in Express's default 400 response
- This bypasses the correlation ID logging and error tracking
- No consistent error response format across parse vs. business logic errors

**Recommendation:** Add custom error handler middleware for JSON parse errors to maintain consistent logging.

## Medium-Priority Issues

### 6. **Logging: Missing Request/Response Metadata**
**Severity: Medium**

The request logging doesn't capture response status or timing information.

**Problems:**
- No visibility into response status for debugging
- No request duration/latency tracking for performance monitoring
- Inconsistent telemetry for API health

**Recommendation:** Add response logging middleware that captures HTTP status code and request duration.

### 7. **Configuration: Missing Environment Validation**
**Severity: Medium**

The application doesn't validate required environment variables on startup.

**Problems:**
- `BILLING_API` and `BILLING_KEY` are optional; missing them will cause runtime failures on first subscription attempt
- `PORT` defaults to 3000 but may conflict in some environments
- No validation that BILLING_API is a valid URL

**Recommendation:** Validate all required environment variables before starting the server.

## Low-Priority Issues

### 8. **Code Quality: Implicit Type Coercion**
**Location:** `billing.js:10`

`String(payload.cardNumber).slice(-4)` assumes `cardNumber` exists. If missing, returns 'undefined'.slice(-4) = 'fined', which is confusing in error messages.

**Recommendation:** Add explicit validation or use optional chaining with a fallback value.

## Strengths

- **Structured logging design** - JSON format with correlation IDs is appropriate for distributed tracing
- **Separation of concerns** - Billing logic separated from HTTP layer
- **Simple error response** - Generic error response prevents information leakage in HTTP response
- **Error propagation** - Errors are caught and logged rather than crashing the process

## Testing

- Only one test exists covering log.js output format
- No integration tests for the API endpoints
- No test coverage for error scenarios or edge cases

## Compliance Notes

The implementation violates its own stated security policy of not logging card details. This is a critical compliance issue for PCI DSS and data protection regulations (GDPR, etc.).
