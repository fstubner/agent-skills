# API Documentation Assessment

## Summary

The API documentation (`docs/api.md`) contains **7 material discrepancies** from the actual implementation (`src/api.js`). Partners following the documented endpoints and behavior will experience failures.

## Critical Discrepancies

### 1. API Version Path Mismatch
- **Documented**: `/v1/events` (GET and POST)
- **Implemented**: `/v2/events` (GET and POST)
- **Impact**: All requests will fail with 404 errors.

### 2. Pagination Mechanism
- **Documented**: Offset-based pagination with `?page=2` parameter (50 items per page)
- **Implemented**: Cursor-based pagination with `?after=<id>` parameter (25 items per page)
- **Impact**: Partners cannot iterate through events using the documented method.

### 3. Page Size
- **Documented**: 50 events per page
- **Implemented**: 25 events per page
- **Impact**: Partners expecting 50 items will receive only 25, breaking pagination logic.

### 4. POST Response Status Code
- **Documented**: Returns `201` (Created)
- **Implemented**: Returns `202` (Accepted)
- **Impact**: Partner code checking for 201 status will treat success as failure.

### 5. POST Request Requirements
- **Documented**: No special headers mentioned
- **Implemented**: Requires `idempotency-key` header; returns 400 Bad Request if missing
- **Impact**: All POST requests without this header will fail; requirement not documented.

### 6. Rate Limit Threshold
- **Documented**: 100 requests per minute per token
- **Implemented**: 600 requests per 60-second window (600 per minute)
- **Impact**: Limit is 6× higher than documented, misleading partners about actual constraints.

### 7. Rate Limit Key Basis
- **Documented**: Per token ("per token")
- **Implemented**: Per IP address (using `req.ip`)
- **Impact**: Multi-partner or multi-service deployments sharing an IP will hit rate limits unexpectedly; token-based isolation is not implemented.

## Additional Issues

- **GET response format**: Docs do not specify the response structure. Implementation returns `{ events: [...], nextCursor: ... }`. This should be documented.
- **Missing error responses**: Docs don't document the `400` response for missing `idempotency-key` or the structure of error responses.

## Verification Summary

I verified all active endpoints and configuration in the implementation against the documented behavior. The rate limit middleware uses IP-based tracking as configured in the Express middleware setup, and the route handlers use v2 paths with the documented pagination mismatch.
