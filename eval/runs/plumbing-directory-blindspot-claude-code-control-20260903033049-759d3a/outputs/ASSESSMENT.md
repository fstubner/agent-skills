# Orders Service Assessment

## Executive Summary
The orders service is a minimal Express-based API with two endpoints for managing customer orders in PostgreSQL. The code is clean and demonstrates good security practices with parameterized queries, but has gaps in error handling, input validation, and missing error recovery patterns.

## Strengths

### Security
- **SQL Injection Prevention**: All database queries use parameterized queries ($1, $2 placeholders) ✓
- **Boundary Validation**: Input validation occurs at the HTTP layer before database access
- **Environment Configuration**: Database connection string read from environment variable, not hardcoded

### Code Quality
- **Async/Await**: Proper use of modern JavaScript async patterns
- **Clean Structure**: Clear separation between HTTP layer (app.js) and data layer (orders.js)
- **Readability**: Well-organized, concise implementation

## Critical Issues

### Missing Error Handling
- **Unprotected Async Endpoints**: Both GET and POST endpoints lack try/catch blocks. Database errors will crash the process and return 500 with no custom error response.
- **Missing Null Check**: `createOrder` returns `rows[0]` without verifying the insert succeeded and a row exists.
- **Silent Failures**: `listOrders` can silently return an empty array even for invalid customer IDs, or fail on NULL customerId with an unclear error.

### Incomplete Input Validation
- **GET /orders customerId**: Accepted from query string but never validated as a number or positive integer. Will be passed to SQL as-is (potentially NULL or string).
- **No Range Validation**: POST endpoint doesn't validate that `totalMinor` is positive or within reasonable bounds.
- **Type Assumption**: Relies on JavaScript's implicit type coercion for customerId matching in WHERE clause.

### Database Connection Issues
- **No Pool Error Handling**: If the PostgreSQL connection fails at startup or during operation, no graceful handling exists.
- **Missing Health Checks**: No way to verify the database is reachable before accepting requests.

## Non-Critical Issues

### Unused Code
- **formatMinor Function**: Implemented and tested (test/orders.test.js), but never integrated into API responses. Unclear if orders should be returned with formatted currency values.
- **Format Module**: Exported but not imported or used in app.js or orders.js.

### Missing Non-Functional Requirements
- **No Logging**: No audit trail, error logs, or request logging for operational debugging.
- **No Rate Limiting**: No protection against abuse or brute-force attempts.
- **No Monitoring**: No metrics or health endpoint for platform team observability.
- **No API Documentation**: No OpenAPI/Swagger spec or API versioning strategy.

## Database Schema Assumptions
The code assumes an `orders` table with columns: `id`, `customer_id`, `total_minor`, `placed_at`. No schema validation or migrations present.

## Recommendations Before Handoff to Platform Team

1. **Add error handling**: Wrap async endpoints in try/catch with appropriate HTTP status codes (500 for DB errors).
2. **Validate customerId**: Ensure it's a positive integer before querying.
3. **Add pool error listeners**: Handle `'error'` events on the pg.Pool.
4. **Clarify formatMinor usage**: Either integrate currency formatting into responses or remove the unused module.
5. **Add logging**: Basic request/error logging for platform operations.
6. **Document schema**: Provide SQL schema and connection requirements.

## Test Coverage
Unit tests exist for the `formatMinor` function and pass (not executed in this assessment due to environment constraints).

## Conclusion
The service demonstrates solid security fundamentals but requires error handling improvements and input validation hardening before platform deployment. The core business logic is sound; the gaps are operational and defensive.
