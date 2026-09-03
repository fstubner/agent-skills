# Subscriptions API Assessment

## Overview
This is a Node.js/Express API that creates subscriptions by forwarding customer data to an external billing provider. The API consists of three modules: `billing.js` (billing provider interface), `server.js` (HTTP endpoint), and `log.js` (structured logging).

## Critical Security Issues

### 1. **Sensitive Personal and Payment Data Logging**
- **Location**: `src/server.js:15` - logs entire request body including headers
- **Issue**: Full card numbers, CVC codes, dates of birth, and email addresses are written to stdout as plain JSON. This violates PCI DSS requirements and general data protection principles.
- **Risk**: Sensitive data exposed in logs, which may be persisted to log aggregation systems, backed up, or accessed by unauthorized parties.
- **Impact**: HIGH - Direct exposure of PCI DSS restricted data (card numbers, CVC)

### 2. **No Input Validation**
- **Location**: `src/server.js:21-23` and `src/billing.js:4-12`
- **Issue**: Request payload is passed directly to the billing API without validation of:
  - Email format
  - Card number format (should be validated against Luhn algorithm at minimum)
  - Expiry date format/validity
  - CVC format (should be 3-4 digits)
  - Date of birth format/reasonableness
- **Risk**: Malformed data sent to external API; potential for injection attacks or DoS
- **Impact**: MEDIUM - Invalid data handling

### 3. **No API Authentication**
- **Location**: `src/server.js:21` - POST /subscriptions endpoint
- **Issue**: The endpoint has no authentication mechanism (no API key, OAuth, Bearer token validation, etc.)
- **Risk**: Anyone can call the endpoint and create subscriptions, including automated bots and attackers
- **Impact**: HIGH - Complete lack of access control

### 4. **Insufficient Error Handling**
- **Location**: `src/billing.js:10` and `src/server.js:27`
- **Issue**: 
  - Error message in `billing.js` includes card number suffix (leaking PII in error logs)
  - `server.js` logs full payload in error cases, including sensitive data
  - Generic 502 error returned without detailed diagnostics
- **Risk**: PII leakage; attackers can infer payment data from error responses
- **Impact**: MEDIUM - Data leakage in error paths

## Design and Implementation Issues

### 5. **Weak Correlation ID Generation**
- **Location**: `src/server.js:10`
- **Issue**: Correlation ID is `c${Date.now()}`, using millisecond timestamps which can collide under load and are predictable
- **Risk**: Unable to reliably trace requests; potential for ID collisions
- **Impact**: LOW - Diagnostics quality degradation

### 6. **No Rate Limiting**
- **Location**: `src/server.js:21-30`
- **Issue**: No rate limiting on subscription creation endpoint
- **Risk**: Endpoint can be abused for subscription spam or DoS attacks
- **Impact**: MEDIUM - Abuse potential

### 7. **No Request Size Limits**
- **Location**: `src/server.js:7` - `express.json()` without size limits
- **Issue**: Express JSON middleware has default size limit (100kb) but should be explicitly configured for security
- **Risk**: Potential for memory exhaustion attacks if limits are increased without consideration
- **Impact**: LOW - Depends on configuration

### 8. **No Response Validation from Billing API**
- **Location**: `src/billing.js:11`
- **Issue**: Assumes billing API returns valid JSON without validating response structure
- **Risk**: If billing API returns unexpected format, application may crash or behave unpredictably
- **Impact**: LOW - Availability concern

### 9. **No Retry Logic**
- **Location**: `src/billing.js:5-9`
- **Issue**: Single attempt to call billing API; transient network failures cause immediate failure
- **Risk**: Poor resilience; legitimate requests fail due to temporary issues
- **Impact**: LOW - Reliability concern

### 10. **Hardcoded Bearer Token Strategy**
- **Location**: `src/billing.js:7`
- **Issue**: Uses single Bearer token from environment variable; no token rotation or revocation mechanism
- **Risk**: Token compromise affects all requests; no way to selectively revoke access
- **Impact**: MEDIUM - Credential management weakness

## Observations

- **Positive**: Structured JSON logging infrastructure is well-designed for traceability
- **Positive**: Separation of concerns between billing logic and HTTP handling
- **Positive**: Test infrastructure in place (though limited coverage)
- **Concern**: Environment variables used for configuration but no validation that required variables are set
- **Concern**: No HTTPS enforcement or security headers in Express configuration

## Verified

I analyzed:
- `src/billing.js` - subscription creation interface with external payment provider
- `src/server.js` - Express HTTP endpoint and request/error handling
- `src/log.js` - structured logging implementation  
- `package.json` - project configuration and dependencies
- `test/log.test.js` - test coverage

The assessment identified 10 significant issues spanning security (sensitive data logging, no authentication), input validation, error handling, and operational resilience.
