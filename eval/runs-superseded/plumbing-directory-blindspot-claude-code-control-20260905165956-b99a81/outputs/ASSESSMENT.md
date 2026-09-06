# Orders Service Assessment

## Overview
The orders service is a small Express API with two endpoints: listing orders for a customer and creating new orders. It uses PostgreSQL for persistence with parameterized queries.

## Security Issues

### Critical: Missing Authentication
- **Severity**: Critical
- **Issue**: Both endpoints lack authentication. Any client can list or create orders for any customer ID.
- **Location**: `src/app.js` lines 7-13
- **Impact**: Unauthorized access to customer data and ability to create fraudulent orders.
- **Recommendation**: Implement authentication (e.g., JWT, OAuth) and authorization checks before accessing customer data.

### High: Insufficient Input Validation (GET /orders)
- **Severity**: High
- **Issue**: The `customerId` query parameter in GET /orders is not validated. Accepts any value, including non-integers, which may cause database errors or unexpected behavior.
- **Location**: `src/app.js` line 7
- **Current**: Only POST validates `customerId` exists and `totalMinor` is an integer.
- **Recommendation**: Validate that `customerId` is a positive integer before querying.

### Medium: No Bounds Validation on Order Amount
- **Severity**: Medium
- **Issue**: POST /orders only validates that `totalMinor` is an integer, not its bounds. Allows negative amounts (observed in format.js test) and arbitrarily large amounts.
- **Location**: `src/app.js` lines 9-10
- **Recommendation**: Add bounds checking for reasonable order amounts (e.g., > 0 and < 999,999,999).

## Code Quality Issues

### Missing Error Handling
- **Issue**: Database operations in `src/orders.js` lack try-catch blocks. Query failures (connection errors, constraints violations) will crash the server.
- **Location**: `src/orders.js` lines 6, 11-14
- **Recommendation**: Add proper error handling with meaningful error responses to clients.

### Unused Utility Function
- **Issue**: The `formatMinor()` function in `src/format.js` is tested but never used by the API. Order amounts are returned as raw integers.
- **Location**: `src/format.js`
- **Recommendation**: Either use the formatter in responses (e.g., `{"total": "12.34"}`) or remove unused code.

### Limited Test Coverage
- **Issue**: Test suite only covers the `formatMinor()` utility. No tests for API endpoints, database interactions, or error cases.
- **Location**: `test/orders.test.js`
- **Recommendation**: Add integration tests for both endpoints, including error scenarios (missing fields, invalid input, DB failures).

## Operational Concerns

### No Error Response Standardization
- POST returns error as `{"error": "..."}` for validation failures
- DB errors would return unhandled exception responses (inconsistent format and expose stack traces)
- GET has no documented error responses

### No Request/Response Logging
- No logging of database queries, errors, or request details
- Makes debugging and audit trails difficult

## Positive Findings

✓ SQL injection protection via parameterized queries (both endpoints)
✓ JSON request/response handling configured correctly
✓ Database schema appears reasonable (orders table with customer_id, total_minor, placed_at)
✓ Proper use of async/await

## Summary

The service has a **critical authentication gap** and **insufficient input validation** that must be addressed before handoff. While the core database interactions are implemented safely (parameterized queries), missing error handling could cause production outages. The test suite needs expansion to cover API endpoints, not just utilities.

**Not ready for production without addressing authentication, input validation, and error handling.**
