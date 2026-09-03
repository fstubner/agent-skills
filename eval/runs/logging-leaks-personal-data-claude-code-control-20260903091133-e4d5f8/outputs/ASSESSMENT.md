# Subscriptions API Assessment

## Overview
This is a Node.js/Express-based subscriptions API that acts as a proxy to an external billing provider. The API accepts customer subscription requests containing sensitive payment card information and forwards them to a billing service.

## Critical Security Issues

### 1. **Sensitive Data Logging (CRITICAL)**
**Location:** `server.js:15` - `body: req.body`

The request body containing full credit card numbers, expiry dates, CVC codes, and personal information (email, date of birth) is logged in plaintext JSON to stdout. This violates:
- PCI DSS compliance requirements (credit card data must never be logged)
- GDPR and other data protection regulations
- Basic security best practices

**Impact:** Payment card and personal data is exposed in application logs, creating a breach risk and compliance violation.

**Recommendation:** Never log sensitive payment data. If logging is needed, sanitize the payload to exclude cardNumber, cvv, expiry, and sensitive personal fields.

### 2. **Sensitive Information in Error Messages (HIGH)**
**Location:** `billing.js:10` - Error includes card number substring

The error message includes the last 4 digits of the card number in logged errors. While reduced, this is still sensitive information that could be leaked through error tracking systems, logs, or error responses.

**Recommendation:** Remove card information from error messages entirely. Use a generic error message without any card identifiers.

### 3. **Headers Logging (MEDIUM)**
**Location:** `server.js:16` - `headers: req.headers`

All request headers are logged, which could include authorization tokens, API keys, or other sensitive data passed by clients.

**Recommendation:** Only log essential headers and exclude Authorization, Cookie, and other sensitive headers.

## Code Quality & Design Issues

### 4. **No Input Validation**
The API forwards the request body directly to the billing service without validating its structure or required fields. Missing or malformed fields could cause unexpected behavior or errors.

**Recommendation:** Implement schema validation (e.g., with a library like `zod` or `joi`) to validate:
- Required fields: `cardNumber`, `email`, `expiry`, `cvv`, `dateOfBirth`
- Field formats and types
- Return 400 Bad Request for invalid input

### 5. **Missing Environment Variable Validation**
`BILLING_API` and `BILLING_KEY` environment variables are used without checking if they exist, which could cause runtime errors in production.

**Recommendation:** Validate required environment variables at startup and fail fast if not configured.

### 6. **No Request Timeout**
The `fetch` call in `billing.js` has no timeout configured. Requests could hang indefinitely waiting for the billing provider.

**Recommendation:** Add a timeout (e.g., 30 seconds) to prevent hanging requests.

### 7. **Incorrect HTTP Status Code**
**Location:** `server.js:28` - Status 502 (Bad Gateway)

Using 502 Bad Gateway is semantically incorrect for billing failures. 502 implies the gateway received an invalid response from the upstream server, but the API uses it for all errors.

**Recommendation:** 
- Use 400 Bad Request for validation failures
- Use 500 Internal Server Error for billing service failures
- Use 503 Service Unavailable if billing service is down

### 8. **Generic Error Response**
The error response `{ error: 'could not create subscription' }` doesn't distinguish between different failure types, making it difficult for clients to handle errors appropriately.

**Recommendation:** Return more specific error codes and messages, or at least log the actual error for debugging while keeping the client response generic.

### 9. **No Rate Limiting or Abuse Prevention**
The subscription endpoint has no rate limiting, making it vulnerable to:
- Brute force attacks on card testing
- Denial of service attacks
- Excessive billing provider usage

**Recommendation:** Implement rate limiting based on IP address, user account, or API key.

### 10. **Potential Async Error in JSON Parsing**
**Location:** `billing.js:11` - `res.json()` could fail

If the response is not valid JSON, the promise rejection isn't explicitly handled, though the catch block would catch it.

**Recommendation:** This is acceptable as-is since the catch block handles it, but being explicit about parsing errors would improve clarity.

## Testing Gaps

The test file only covers the logging utility, not the API endpoints. There are no tests for:
- Subscription creation success path
- Error handling and status codes
- Input validation
- Integration with billing service

## Summary of Findings

**Critical Issues:** 1 (Sensitive data logging)  
**High Severity:** 1 (Card info in errors)  
**Medium Severity:** 2 (Headers logging, rate limiting)  
**Code Quality Issues:** 4 (Input validation, env vars, timeout, status codes)

The API has a fundamental security flaw in logging sensitive payment card data, which must be fixed immediately. Several other improvements around input validation, error handling, and operational resilience are also needed.
