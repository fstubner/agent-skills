# Subscriptions API Assessment

## Overview
The subscriptions API is a simple Express.js service that creates subscriptions by proxying requests to a payment provider. While the core functionality exists, there are critical security, design, and operational issues.

## Critical Security Issues

### 1. PII/Sensitive Data Logging (CRITICAL)
**Location**: `server.js:15` (request logging middleware)

The middleware logs the entire request body and headers, which includes:
- Full card number
- Card expiry date
- CVC code
- Date of birth
- Other sensitive PII

**Impact**: Violates the stated security policy ("We do not log card details" in README.md). Sensitive data is written to logs that are retained for 2 years and accessible to the entire engineering team.

**Contradiction**: The README explicitly states "We do not log card details" but the implementation does exactly that.

### 2. Information Disclosure in Error Messages (HIGH)
**Location**: `billing.js:10`

Error message includes the last 4 digits of the card number:
```javascript
throw new Error(`billing returned ${res.status} for card ending ${String(payload.cardNumber).slice(-4)}`);
```

**Impact**: Card number fragments appear in error logs accessible to all engineers. This is unnecessary for debugging.

## Input Validation Issues

### 3. No Input Validation (HIGH)
**Location**: `server.js:21-23`

The `/subscriptions` endpoint accepts any payload without validation:
- No schema validation
- No required field checks
- No type validation
- No sanitization

**Risk**: Malformed requests cause unclear errors; invalid data is forwarded to the payment provider.

### 4. Missing Authentication/Authorization (HIGH)
**Location**: `server.js:21`

The POST endpoint has no authentication or authorization controls:
- No API key validation
- No user identification
- No rate limiting
- Any client can create subscriptions

**Risk**: Open to abuse; no accountability for subscription creation.

## Design Limitations

### 5. Limited API Scope (MEDIUM)
The API only supports creating subscriptions:
- No way to retrieve subscription details
- No way to update subscriptions
- No way to cancel subscriptions
- No way to list user subscriptions

**Impact**: Clients need additional infrastructure to manage their subscriptions.

### 6. Generic Error Response (MEDIUM)
**Location**: `server.js:28`

```javascript
res.status(502).json({ error: 'could not create subscription' });
```

- Returns 502 for all errors (both client and server issues)
- No distinction between validation failures, billing provider errors, or server errors
- No error code or details to help clients respond appropriately

**Better approach**: Use appropriate status codes (400 for invalid input, 502 for provider errors) and include error codes.

### 7. Weak Correlation ID Generation (LOW)
**Location**: `server.js:10`

```javascript
req.correlationId = `c${Date.now()}`;
```

- Correlation IDs based on timestamp are predictable
- No randomness to avoid collisions in high-concurrency scenarios
- Multiple requests in the same millisecond could have the same ID

## Operational Concerns

### 8. Incomplete Error Context (MEDIUM)
**Location**: `billing.js:5-11`

The error thrown doesn't capture the full response from the billing provider:
- HTTP status logged but not response body
- Makes debugging provider issues difficult
- No retry logic despite transient failures being common in payment processing

### 9. No Input Type Coercion (MEDIUM)
The card number is converted to a string for logging (`String(payload.cardNumber)`) but only in the error path. No consistent handling of data types.

## Compliance & Policy Issues

### 10. Policy Non-Compliance (CRITICAL)
**Location**: README.md statement vs. `server.js:15`

The README states "We do not log card details" but the code logs:
- Full card numbers
- Expiry dates  
- CVC codes
- Date of birth

This is a direct contradiction between stated policy and implementation.

## Positive Aspects

- Structured JSON logging with correlation IDs supports traceability
- Separation of concerns (logging, billing, routing)
- Uses standard Express.js patterns
- Async/await for clean code flow
- Has basic test coverage

## Summary of Issues by Severity

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 2 | PII data logging, policy non-compliance |
| HIGH | 3 | Information disclosure in errors, no input validation, no authentication |
| MEDIUM | 4 | Limited API scope, generic errors, incomplete error context, type handling |
| LOW | 1 | Weak correlation ID generation |

## Recommended Actions

1. **Immediately**: Stop logging request body and headers; implement field-level sanitization
2. **Immediately**: Remove sensitive data from error messages
3. **High Priority**: Add input validation and schema checking
4. **High Priority**: Implement API authentication and rate limiting
5. **Medium Priority**: Expand API to support subscription management operations
6. **Medium Priority**: Improve error responses with appropriate status codes and error codes
7. **Medium Priority**: Enhance error context for better debugging and retry logic
