# Orders Service Assessment

## Overview
The orders service is a minimal Express.js API for managing customer orders with PostgreSQL persistence. It provides two endpoints: listing a customer's orders and creating new orders.

## Strengths

### Security
- **SQL Injection Protection**: All database queries use parameterized statements ($1, $2 placeholders) preventing SQL injection attacks.
- **Input Validation**: POST endpoint validates required fields (customerId as present, totalMinor as integer).
- **Dependency Selection**: Using pg driver with connection pooling is production-appropriate.

### Code Quality
- **Simplicity**: Minimal, readable codebase with clear separation of concerns (app.js for routing, orders.js for data access).
- **ES Modules**: Modern JavaScript module syntax.
- **Currency Formatting**: Well-implemented `formatMinor()` function with correct handling of decimal places and negative values.

## Significant Issues

### Critical: Missing Error Handling
- No try/catch blocks in database operations. Database errors (connection failures, constraint violations, timeouts) will crash the application.
- Example: `listOrders()` and `createOrder()` can throw unhandled exceptions.
- **Impact**: Service becomes unavailable on database errors.

### Critical: Authorization/Authentication Gap
- GET /orders endpoint accepts any customerId without verification. A user can request another customer's orders.
- No authentication headers or identity verification present.
- POST /orders doesn't verify the customerId belongs to the authenticated user.
- **Impact**: Unauthorized data access and potential order manipulation.

### High: Incomplete Input Validation
- GET endpoint doesn't validate the `customerId` query parameter (accepts undefined/null/non-numeric values).
- Missing validation on data types: `customerId` could be a string, negative number, or other invalid type on both endpoints.
- **Impact**: Invalid requests may reach the database or behave unexpectedly.

### High: No Pagination
- `listOrders()` returns all orders for a customer without limit.
- **Impact**: Large result sets could cause memory issues and poor API response times.

### High: Unused Code
- `formatMinor()` utility function exists but is never used in API responses. Responses return raw integer `totalMinor` values instead of formatted currency strings.
- **Impact**: API consumers need their own currency formatting logic.

### Medium: Incomplete Test Coverage
- Test suite only covers `formatMinor()` utility function.
- No tests for API endpoints, database operations, or error cases.
- **Impact**: Regression risk and no validation of actual API behavior.

### Medium: No Logging or Monitoring
- No request/response logging.
- No error logging.
- **Impact**: Difficult to debug issues or trace requests in production.

### Medium: Missing Database Considerations
- No index mentioned for `orders.customer_id` or `orders.placed_at` columns (critical for list queries).
- No connection pool configuration (timeout, max connections, idle timeout).
- **Impact**: Performance degradation under load.

### Low: Minimal API Documentation
- README states validation happens at boundary and queries are parameterized, but lacks API specification.
- No error response format documented.
- Missing expected database schema.

## Recommendations

1. **Add error handling**: Wrap database operations in try/catch; return 500 responses with appropriate error messages.
2. **Implement authentication**: Add middleware to verify customer identity; ensure users can only access their own orders.
3. **Validate all inputs**: Type-check customerId (should be a positive integer) in both endpoints.
4. **Add pagination**: Implement limit/offset or cursor-based pagination for list orders.
5. **Use formatMinor()**: Format `totalMinor` values in API responses using the existing utility.
6. **Expand test coverage**: Add integration tests for both endpoints and error scenarios.
7. **Add logging**: Implement structured logging for requests, errors, and database operations.
8. **Database configuration**: Document required indexes and connection pool settings.
9. **API documentation**: Document endpoint contracts, error responses, and schema.

## Verified Aspects
- Parameterized queries prevent SQL injection
- POST input boundary validation is present
- ES module and Express configuration are correct
- Currency formatting logic is mathematically sound
