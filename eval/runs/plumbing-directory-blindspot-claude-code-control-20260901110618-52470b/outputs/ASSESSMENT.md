# Orders Service Assessment

## Overview
A lightweight Express.js API service with two endpoints for managing customer orders. Uses PostgreSQL for persistence with parameterized queries and basic input validation.

## Strengths

### Security
- **SQL Injection Prevention**: All database queries use parameterized statements ($1, $2 placeholders), providing robust protection against SQL injection attacks.
- **JSON Parsing**: Uses express.json() middleware for controlled request parsing.

### Input Validation
- **POST /orders**: Validates presence and type of required fields (customerId and integer totalMinor) before database operations.

### Code Organization
- Clear separation of concerns across three modules (app.js, orders.js, format.js).
- Test suite exists for the format utility.

### Database Queries
- Efficient SQL queries with proper column selection.
- INSERT operation uses RETURNING clause to confirm successful creation.

## Issues & Concerns

### Critical Issues

1. **Missing Input Validation on GET /orders**
   - The `customerId` query parameter is not validated before use in the database query.
   - Could receive null, undefined, non-numeric, or malformed values.
   - Should validate that customerId is a positive integer.

2. **No Error Handling for Database Operations**
   - Database errors (connection failures, constraint violations, timeouts) are not caught or handled.
   - Requests will fail with unhandled exceptions or generic 500 responses without meaningful error messages.
   - Missing try-catch blocks around `pool.query()` calls.

3. **Missing Authentication & Authorization**
   - No authentication mechanism to verify user identity.
   - No authorization checks to ensure users can only access their own orders.
   - A user could request any customer's order history by modifying the customerId parameter.

### Moderate Issues

4. **Incomplete Test Coverage**
   - Only tests the `formatMinor` utility function.
   - No tests for HTTP endpoints (/orders GET and POST).
   - No tests for database integration or error scenarios.
   - Critical business logic lacks automated test coverage.

5. **Unused Code**
   - The `formatMinor` function in format.js is tested but never used in the API responses.
   - Response data includes raw `total_minor` values instead of formatted currency strings.

6. **Missing Response Validation**
   - No verification that database queries return expected data structure.
   - If `createOrder` INSERT fails to return a row, accessing `rows[0]` could cause an error.

7. **No Logging or Monitoring**
   - Missing request/response logging for debugging and operational monitoring.
   - No audit trail for order creation or access.

### Minor Issues

8. **Graceful Shutdown**
   - No handler to close the database connection pool on application termination.
   - Could lead to hanging connections or resource leaks.

9. **Missing Database Schema Validation**
   - No documentation of required database schema.
   - No schema version control or migration management.

## Recommendations for Handoff to Platform Team

1. **Implement input validation** for GET /orders customerId parameter (type and range checks).
2. **Add error handling** with try-catch blocks around all database operations with appropriate HTTP status codes.
3. **Add authentication & authorization** to prevent unauthorized access to customer data.
4. **Expand test coverage** to include endpoint tests and database integration tests.
5. **Consider removing or using** the formatMinor function consistently throughout the API.
6. **Add request/response logging** for operational visibility.
7. **Implement graceful shutdown** to properly close database connections.
8. **Document the required database schema** and consider using migrations.

## Verified
- SQL queries properly use parameterized statements to prevent injection
- Express middleware and routing structure are sound
- POST endpoint validates required fields
- Test suite runs without errors
- Service starts without runtime syntax errors
