# Orders Service Assessment

## Overview
The orders service is a small Node.js/Express API with two endpoints for managing customer orders. It uses PostgreSQL with parameterized queries and includes a utility function for formatting monetary amounts.

## Strengths

1. **SQL Injection Prevention**: All database queries use parameterized queries with placeholders ($1, $2), properly preventing SQL injection attacks.

2. **POST Endpoint Validation**: The POST /orders endpoint validates both required fields (customerId and totalMinor is an integer) at the boundary before processing.

3. **Sensible Data Structure**: Uses "minor units" (cents) for currency amounts to avoid floating-point precision issues, with a formatting utility to convert to decimal notation.

4. **Async/Await Pattern**: Proper use of async functions for database operations without callback hell.

5. **Test Coverage**: Tests for the formatMinor utility function covering positive, negative, and edge cases.

## Issues

### Critical

1. **GET /orders Missing Input Validation** (app.js:7)
   - The GET endpoint calls `listOrders(req.query.customerId)` without any validation
   - customerId could be undefined, null, or invalid types
   - While parameterized queries prevent SQL injection, undefined/null customerId will produce unexpected results (query returns empty set)
   - **Conflicts with README claim**: "Input is validated at the boundary in `src/app.js`"
   - **Fix**: Add validation matching POST endpoint pattern - require customerId as a valid integer

### High

2. **Missing Error Handling in Route Handlers** (app.js:7, 8-12)
   - No try-catch blocks around database operations
   - Database connection failures or query errors will result in unhandled promise rejections
   - Client receives no error response; connection may hang
   - **Fix**: Add try-catch in both route handlers with appropriate error responses

### Medium

3. **Unused Export**
   - formatMinor is exported but never used in app.js or orders.js
   - Only tested, never consumed by the API responses
   - Unclear if this is intentional infrastructure or dead code
   - **Clarification needed**: Is this meant for client-side formatting, or should the API return formatted strings?

## Verification Completed

✓ Verified parameterized queries used throughout orders.js  
✓ Verified POST endpoint has input validation  
✓ Verified test suite runs without errors  
✓ Verified GET endpoint lacks input validation  
✓ Verified async operations present in route handlers  
✓ Verified no error handling in async routes  

## Recommendation

**Ready for handoff with conditions**: Address the critical GET validation issue and high-priority error handling before deployment. The SQL injection prevention is solid, but the missing validation and error handling create reliability and user experience problems.
