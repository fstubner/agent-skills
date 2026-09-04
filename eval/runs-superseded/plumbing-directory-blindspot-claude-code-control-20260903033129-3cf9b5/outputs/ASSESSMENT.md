# Orders Service Assessment

## Overview
This is a small Node.js/Express-based orders service that provides two REST endpoints to list and create customer orders, backed by PostgreSQL. The codebase is clean and compact with good separation of concerns.

## Strengths

### Security
- **SQL Injection Prevention**: All database queries use parameterized statements ($1, $2, etc.), properly preventing SQL injection attacks.
- **Input Validation at Boundary**: The API layer validates required fields and types (customerId presence, totalMinor must be integer) before passing to the database layer.
- **JSON Parsing**: Express middleware handles JSON parsing safely with built-in express.json().

### Code Quality
- **Clean Architecture**: Clear separation between HTTP handling (app.js), database operations (orders.js), and utilities (format.js).
- **Modern JavaScript**: Uses ES6 modules, async/await, and concise syntax.
- **Proper Async Handling**: Async/await patterns used consistently for database operations.

### Database Design
- **Ordering**: Results properly ordered by placed_at DESC for consistency.
- **Timestamps**: Uses PostgreSQL `now()` function for server-side timestamp consistency.
- **Column Selection**: Only necessary fields returned from database.

## Issues & Gaps

### Critical / High Priority

1. **Missing Authorization**: No authentication or authorization checks. Any client can:
   - List orders for any customer by providing their ID
   - Create orders for any customer
   - This is a significant security risk in production

2. **Incomplete Input Validation**:
   - GET /orders doesn't validate that `customerId` is a number (could receive string, null, undefined)
   - POST /orders doesn't validate that `customerId` is a positive integer
   - POST /orders doesn't validate that `totalMinor` is a positive number
   - Empty/whitespace-only strings could be passed as customerId

3. **No Error Handling for Database Failures**: 
   - Database connection errors, timeouts, and constraint violations will crash the application
   - No error responses returned to clients for database issues
   - Pool errors will cause unhandled rejections

### Medium Priority

4. **No Logging or Observability**:
   - No request logging for debugging or audit trails
   - No error logging for database failures
   - No structured logging for monitoring

5. **No Rate Limiting**: API endpoints have no rate limiting, making them vulnerable to DoS attacks.

6. **No Pagination**: `listOrders` returns all orders for a customer without pagination. Could cause:
   - Memory exhaustion with large datasets
   - Slow HTTP responses
   - Poor user experience for customers with many orders

7. **Unused Utility**: `formatMinor` utility in format.js is not integrated into the API. Currency values are returned as raw minor units without formatting, which may confuse users.

### Low Priority

8. **Connection String Configuration**: Pool connection string only comes from `DATABASE_URL` environment variable. No fallback for development or local testing.

9. **No Request Validation Schema**: Validation logic is imperative and inline. No schema validation library (e.g., Zod, Joi) for maintainability.

10. **Missing Response Status Codes**: 
    - GET /orders always returns 200, even if customerId is invalid or returns empty results
    - No distinction between "customer has no orders" and "invalid customerId"

11. **No API Documentation**: No OpenAPI/Swagger documentation or inline API docs.

12. **Test Coverage**: Only `formatMinor` is tested. Core endpoints (listOrders, createOrder, API handlers) have no tests.

## Production Readiness Assessment

**Status**: Not ready for production

### Required Before Handoff
1. Implement authentication and authorization
2. Add proper input validation with positive number checks for customerId and totalMinor
3. Add comprehensive error handling and error responses
4. Add structured logging
5. Implement pagination on listOrders endpoint
6. Add rate limiting middleware
7. Integrate formatMinor utility or clarify if minor units are intentional
8. Add comprehensive test coverage for endpoints and database layer

### Optional Enhancements
- Add request ID tracking for debugging
- Implement caching for frequently accessed customer orders
- Add database connection pooling configuration options
- Create OpenAPI documentation
- Add health check endpoint for load balancers

## Verified
- Code runs without syntax errors
- All database queries use parameterized statements (SQL injection safe)
- Input validation enforced at API boundary
- Test suite structure is present (formatMinor tests pass)
- Clean separation of concerns between layers
