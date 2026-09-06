# Subscriptions API Assessment

## Overview
The API creates subscriptions by delegating to an external payment provider. It uses structured JSON logging with correlation IDs and Express.js for HTTP handling.

## Critical Issues

### 1. Logging Sensitive Card Data (CRITICAL - Security)
**Location:** `src/server.js:17`

**Issue:** The request body is logged in its entirety:
```javascript
body: req.body,
```

This logs the full card number, expiry, CVC, and date of birth. The README explicitly states "We do not log card details" but the implementation contradicts this.

**Impact:** Violates PCI-DSS compliance, exposes sensitive payment information to the log store which is retained for two years.

**Recommendation:** Do not log the request body, or sanitize it to exclude sensitive fields.

---

### 2. Logging Authorization Headers (HIGH - Security)
**Location:** `src/server.js:16`

**Issue:** All request headers are logged:
```javascript
headers: req.headers,
```

This exposes the `authorization` header containing `BILLING_KEY`.

**Impact:** Credentials leak to the central log store, compromising the payment provider API key.

**Recommendation:** Filter headers to exclude `authorization` and other sensitive headers before logging.

---

### 3. Card Details in Error Messages (HIGH - Security)
**Location:** `src/billing.js:10`

**Issue:** Error message includes last 4 digits of card number:
```javascript
`billing returned ${res.status} for card ending ${String(payload.cardNumber).slice(-4)}`
```

**Impact:** Card information flows into error logs and may be exposed to users/monitoring systems.

**Recommendation:** Remove all card-related details from error messages.

---

## Major Issues

### 4. No Input Validation (MEDIUM - Correctness)
**Location:** `src/server.js:23`, `src/billing.js`

**Issue:** Payload is sent directly to the payment provider without validation. No checks for:
- Required fields (email, cardNumber, expiry, cvc, dateOfBirth)
- Field formats (email format, card number length, expiry date format, CVC length, date of birth format)

**Impact:** Invalid requests fail at the payment provider, causing unclear error messages and poor user experience.

**Recommendation:** Add schema validation before calling `createSubscription`.

---

### 5. Unsafe Card Number Handling (MEDIUM - Correctness)
**Location:** `src/billing.js:10`

**Issue:** No null check before converting card number:
```javascript
String(payload.cardNumber).slice(-4)
```

If `cardNumber` is null/undefined, this still converts it (becoming `"null"`/`"undefined"`).

**Recommendation:** Validate card number exists and is a valid format.

---

## Moderate Issues

### 6. Overly Broad Error Response (LOW - Usability)
**Location:** `src/server.js:28`

**Issue:** All subscription failures return:
```javascript
res.status(502).json({ error: 'could not create subscription' })
```

**Problem:** 
- 502 (Bad Gateway) is for when the upstream service is unreachable. Other errors (validation, rate limits, insufficient funds) should use different status codes.
- The error message is generic and doesn't help the client understand the failure.

**Recommendation:** Return appropriate status codes (400 for bad input, 402 for payment issues, 502 for service unavailable, etc.) and include relevant error details.

---

### 7. No Request Size Limit (MEDIUM - Security/DoS)
**Location:** `src/server.js:7`

**Issue:** `express.json()` uses default size limits (100kb). While not critical, large payloads could accumulate.

**Impact:** Potential DoS vector through large request payloads.

**Recommendation:** Set explicit size limits: `express.json({ limit: '10kb' })`.

---

### 8. Missing Response Validation (LOW - Robustness)
**Location:** `src/billing.js:11`

**Issue:** The response from the payment provider is returned directly without validation:
```javascript
return res.json();
```

**Impact:** If the payment provider returns malformed data, the API propagates it without checking.

**Recommendation:** Validate the response structure before returning to client.

---

## Minor Issues

### 9. Correlation ID Generation (LOW - Reliability)
**Location:** `src/server.js:10`

**Issue:** Uses `Date.now()` as correlation ID, which can have collisions at high throughput (multiple requests in the same millisecond).

**Recommendation:** Use a UUID or append a counter to ensure uniqueness.

---

### 10. No Retry Logic (LOW - Resilience)
**Location:** `src/billing.js:5-9`

**Issue:** Single attempt to reach payment provider with no retry on transient failures.

**Impact:** Temporary network hiccups or provider issues cause immediate failures.

**Recommendation:** Implement exponential backoff retry logic for transient errors (5xx, timeouts).

---

## Summary

**Critical security issues prevent production deployment:**
- Sensitive card data and credentials are logged
- Input validation is missing

**Before this API reaches production, it must:**
1. Remove sensitive data from logs (card details, authorization headers)
2. Add comprehensive input validation
3. Improve error handling and status codes
4. Filter sensitive fields from logging

The core functionality is sound, but the implementation has significant security and correctness gaps.
