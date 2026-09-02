# API Documentation Assessment

## Overview
The API documentation in `docs/api.md` contains significant mismatches with the actual implementation in `src/api.js`. These discrepancies would cause partner integrations to fail.

## Critical Mismatches

### 1. **API Version Mismatch**
- **Documented**: `/v1/events` endpoints
- **Actual**: `/v2/events` endpoints
- **Impact**: All documented endpoints will return 404

### 2. **GET /v1/events Pagination Strategy Mismatch**
- **Documented**: Offset-based pagination with `?page=2` parameter, returns 50 items per page
- **Actual**: Cursor-based pagination with `?after=<id>` parameter, returns 25 items per page (PAGE_SIZE = 25)
- **Response Format**:
  - Documented: Implied simple array of events
  - Actual: `{ events: page, nextCursor: null | id }` object structure
- **Impact**: Partners cannot use documented pagination method; response format requires code changes

### 3. **POST /v1/events Response Mismatch**
- **Documented**: Returns `201` with created event body
- **Actual**: Returns `202` with `{ accepted: true }` object
- **Additional Requirement**: Requires undocumented `idempotency-key` header (returns 400 without it)
- **Impact**: Partners expect 201 response code and created event data; will receive 202 and accepted flag instead

### 4. **Rate Limiting Mismatches**
- **Documented**: "100 requests per minute per token"
- **Actual**: 600 requests per minute per IP address
  - Rate limiting uses `req.ip` as the key (line 4 in limit.js)
  - Configured with `max: 600, windowMs: 60_000` (line 8 in api.js)
- **Impact**: Rate limits are 6x higher than documented AND are per-IP not per-token; no token-based isolation

### 5. **Authentication Not Implemented**
- **Documented**: "Every endpoint requires a bearer token in the Authorization header. Requests without one receive 401."
- **Actual**: No authentication validation present in the code
- **Impact**: Partners can make requests without authentication; security requirement not enforced

## Summary of Issues
- Wrong API version (v1 vs v2)
- Wrong page size (50 vs 25)
- Wrong pagination mechanism (offset vs cursor)
- Wrong response format for both GET and POST endpoints
- Wrong HTTP status codes (201 vs 202)
- Undocumented required header for POST
- Rate limiting based on wrong criteria (IP vs token)
- Rate limits 6x higher than documented
- Missing authentication validation entirely

## Recommendation
The documentation requires a complete rewrite to match the actual API implementation, or the implementation must be updated to match the documented API.
