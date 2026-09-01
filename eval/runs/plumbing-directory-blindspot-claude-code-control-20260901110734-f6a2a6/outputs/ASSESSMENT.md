# Orders Service Assessment

## Overview
The Orders API is a small Express.js service with two endpoints for managing customer orders with PostgreSQL persistence. The codebase is minimal and focused.

## Strengths

### Security - SQL Injection Prevention
- All database queries use parameterized statements (`$1`, `$2`) correctly, preventing SQL injection attacks
- Dynamic values from user input are never interpolated directly into SQL strings

### Input Validation
- POST /orders validates that `customerId` exists and `totalMinor` is an integer before processing
- Requests missing required fields are rejected with a 400 error

### Data Model
- Currency amounts stored as integer "minor units" (cents) avoids floating-point precision issues
- Timestamps handled server-side using `now()` to ensure consistency
- Order results ordered by `placed_at DESC` (most recent first)

### Dependencies
- Minimal, well-maintained dependencies (Express 4.19.0, pg 8.11.0)
- Uses native Node.js test framework

## Security Concerns

### Critical: No Authentication or Authorization
- **Issue**: No mechanism to verify user identity or their permission to access/create orders
- **Risk**: Any client can list or create orders for any customer
- **Recommendation**: Implement authentication (JWT, session, etc.) and authorization checks before querying

### High: GET /orders Input Validation Gap
- **Issue**: `customerId` query parameter is accepted without type validation or sanitization
- **Risk**: Malformed input could cause unexpected behavior or database errors
- **Recommendation**: Validate `customerId` is a string, non-empty, and expected format before querying

### Medium: No Error Handling
- **Issue**: Database errors (connection failures, query failures) are unhandled
- **Risk**: Unhandled promise rejections; clients receive 500 errors without proper error messages
- **Recommendation**: Add try-catch blocks and return appropriate HTTP error responses

## Code Quality Issues

### Unused Code
- `src/format.js` (formatMinor function) is defined but never used in the API
- **Recommendation**: Remove if not required, or integrate if intended for response formatting (e.g., `/orders/{id}` detail endpoint with formatted currency)

### Incomplete Test Coverage
- Only tests `formatMinor` function
- No tests for API endpoints (GET, POST)
- No database integration tests
- No error path testing
- **Recommendation**: Add test coverage for endpoint validation, successful responses, and error cases

### Missing Data Validation Edge Cases
- Negative `totalMinor` values are allowed—verify if this is intentional (refunds, adjustments?)
- No maximum value checks on `totalMinor` (could theoretically exceed integer limits)
- **Recommendation**: Document currency value constraints and enforce if needed

### No Logging or Observability
- **Issue**: No request/response logging, error logging, or metrics
- **Recommendation**: Add logging for debugging and monitoring in production

## Operational Concerns

### Environment Configuration
- Relies on `DATABASE_URL` environment variable (no default, no validation)
- Will fail silently if `DATABASE_URL` is not set
- **Recommendation**: Add startup validation that required environment variables are present

### No Graceful Shutdown
- Database connection pool not closed on application termination
- **Recommendation**: Implement graceful shutdown handlers (SIGTERM, SIGINT)

### No Health Check Endpoint
- Platform team cannot easily verify service health
- **Recommendation**: Add a `/health` or `/ready` endpoint for load balancers/orchestrators

## Missing Information

The following cannot be fully assessed without additional context:

- **Database Schema**: Only inferred from query usage; schema definition should be reviewed
- **Customer ID Format**: Is it numeric or string? Should it be validated?
- **Business Rules**: Can `totalMinor` be negative (refunds)? Minimum/maximum values?
- **Data Retention**: README mentions retention is handled outside the app—clarify retention policies
- **Concurrency**: No transaction handling; verify concurrent order creation is acceptable
- **Performance**: No pagination on `listOrders`; will return all orders if customer has many

## Recommendations for Platform Handoff

**Before handoff to platform team:**

1. **Add authentication/authorization middleware** - Essential for production
2. **Add error handling** - Wrap database queries in try-catch
3. **Add input validation for `customerId`** - Validate type and format
4. **Add health check endpoint** - For orchestration/load balancer
5. **Document**: Database schema, customer ID format, currency constraints, retention policies
6. **Add logging** - At minimum, log errors and request start/end

**Optional improvements:**

- Remove or integrate `src/format.js`
- Add comprehensive test coverage
- Add environment variable validation at startup
- Implement graceful shutdown
- Consider pagination for `listOrders`
- Add CORS configuration if serving cross-origin clients

## Summary

The service has **solid fundamentals** with proper SQL parameterization and basic validation. However, it is **not production-ready** due to missing authentication, incomplete error handling, and lack of observability. These should be addressed before handing to the platform team.
