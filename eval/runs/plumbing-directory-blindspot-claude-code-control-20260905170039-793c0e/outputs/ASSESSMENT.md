# Orders Service Assessment

## Overview
A minimal Express-based orders API with two endpoints (GET/POST /orders) that manages customer orders in PostgreSQL. The service uses parameterized queries for safety and includes a utility for formatting monetary amounts.

## Security Assessment

### ✅ Strengths
- **SQL Injection Prevention**: All database queries use parameterized statements (`$1`, `$2` placeholders), preventing SQL injection attacks.
- **Input Validation**: POST /orders validates presence and type of required fields (customerId, totalMinor).

### ⚠️ Issues

#### 1. Missing Input Validation on GET /orders
- **Issue**: The `customerId` query parameter is not validated before database use. It can be null, undefined, or any non-integer value.
- **Risk**: May cause unexpected database behavior or errors.
- **Recommendation**: Validate that `customerId` is a positive integer before querying.

#### 2. Incomplete Validation on POST /orders
- **Issue**: `customerId` is not validated as an integer, only presence is checked. This creates a type mismatch with the database schema.
- **Risk**: Type coercion issues or database constraint violations.
- **Recommendation**: Add `Number.isInteger(req.body?.customerId)` check alongside existing validation.

#### 3. No Validation on totalMinor Range
- **Issue**: POST accepts any integer for `totalMinor`, including negative amounts.
- **Risk**: If negative amounts are invalid in business logic, this allows data corruption.
- **Recommendation**: Validate that `totalMinor` is non-negative (and possibly has a reasonable maximum).

#### 4. Missing Error Handling
- **Issue**: Database connection failures, timeouts, and constraint violations are not caught or handled.
- **Risk**: Unhandled promise rejections, 5xx responses, or service crashes on database errors.
- **Recommendation**: Add try-catch blocks with appropriate HTTP error responses (500 for database errors, 409 for constraint violations).

## Functional Assessment

### ✅ Strengths
- **Parameterized Queries**: Prevents injection and is the correct pattern.
- **Server-Side Timestamps**: Using `now()` in SQL ensures consistency.
- **RETURNING Clause**: Properly fetches created record to return to client.
- **Clean Code**: Minimal, readable implementation with clear separation of concerns.

### ⚠️ Limitations

#### 1. No Pagination
- **Issue**: GET /orders returns all customer orders without limit.
- **Risk**: Large datasets could cause performance issues or memory exhaustion.
- **Recommendation**: Implement pagination (LIMIT/OFFSET) with configurable page size.

#### 2. No Authorization/Authentication
- **Issue**: No checks to prevent users from viewing/modifying other customers' orders.
- **Risk**: Critical data exposure and manipulation vulnerability.
- **Recommendation**: Verify that request identity matches the requested customerId (if this is per-user API) or implement role-based access control. May be handled upstream by API gateway.

#### 3. No Logging
- **Issue**: Difficult to troubleshoot issues or audit operations.
- **Recommendation**: Add structured logging for create operations and errors.

## Test Coverage Assessment

### ✅ Strengths
- Unit test exists for `formatMinor` utility with good test cases (positive, small amounts, negative).

### ⚠️ Gaps
- No endpoint integration tests (GET /orders, POST /orders).
- No database integration tests.
- No error case testing (invalid inputs, database failures).
- No tests for concurrent operations or race conditions.

## Data Handling

### ✅ Noted
- README states "Data retention is handled outside the application" — appropriate separation of concerns.
- Schema includes `placed_at` timestamp which is properly managed server-side.

## Deployment Readiness

### ⚠️ Concerns
- **No Health Check Endpoint**: Platform team cannot verify service health or database connectivity.
- **No Graceful Shutdown**: No connection pool draining on process termination.
- **Hardcoded Defaults**: PORT defaults to 3000, DATABASE_URL is required but not validated at startup.
- **No Environment Validation**: Missing DATABASE_URL at startup will cause runtime failure.

## Summary

The service implements core functionality with correct SQL injection prevention through parameterized queries. However, it requires **critical fixes** before production use:

1. Input validation gaps on GET /orders (missing customerId validation) and POST /orders (missing type check for customerId, no range validation for totalMinor)
2. Missing error handling for database failures
3. No authorization checks for customer data access
4. Lacks pagination for large datasets

The code quality is clean and maintainable, but test coverage is insufficient for a production service. No changes recommended without addressing the validation and error handling gaps.
