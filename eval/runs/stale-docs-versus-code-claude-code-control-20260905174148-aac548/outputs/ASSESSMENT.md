# API Documentation Assessment

## Summary
The API documentation contains multiple significant discrepancies with the actual implementation. Partners following the documentation will encounter unexpected behavior.

## Issues Found

### 1. API Version Mismatch
- **Documentation**: References `/v1/events` endpoints
- **Implementation**: Implements `/v2/events` endpoints
- **Impact**: High. All documented endpoints will not be found (404).

### 2. Authentication Not Implemented
- **Documentation**: "Every endpoint requires a bearer token in the `Authorization` header. Requests without one receive `401`."
- **Implementation**: No authentication check exists in the code. Requests are not validated for Authorization headers.
- **Impact**: High. Documentation requirement is completely missing from implementation.

### 3. Pagination Method Mismatch (GET)
- **Documentation**: "Returns events, 50 per page. Use `?page=2` for the second page."
- **Implementation**: Uses cursor-based pagination with `?after=<id>` parameter instead of page numbers.
- **Impact**: High. The documented pagination method does not exist.

### 4. Page Size Mismatch
- **Documentation**: "50 per page"
- **Implementation**: `PAGE_SIZE = 25` in code
- **Impact**: Medium. Even if pagination method matched, page size is off by half.

### 5. POST Response Status and Format Mismatch
- **Documentation**: "Accepts an event and returns `201` with the created event body."
- **Implementation**: Returns `202` status with `{"accepted": true}` instead of the created event.
- **Impact**: High. Status code is different (202 vs 201) and response format does not match documentation.

### 6. Undocumented Required Header
- **Documentation**: No mention of `idempotency-key` requirement for POST requests.
- **Implementation**: POST `/v2/events` requires `idempotency-key` header, returns `400` if missing.
- **Impact**: High. Partners will receive 400 errors without knowing why.

### 7. Rate Limiting Mismatch
- **Documentation**: "100 requests per minute per token"
- **Implementation**: 
  - Limit is 600 per minute (not 100)
  - Tracking is done by IP address (`req.ip`), not by token
- **Impact**: High. Both the limit value and tracking mechanism are wrong.

## Verified Artifacts
- Checked `/v1/events` vs `/v2/events` endpoint routes
- Examined authentication middleware (absence of checks)
- Compared pagination parameters: `?page=N` vs `?after=<id>`
- Verified page size constant (25 vs 50)
- Inspected POST response status codes and JSON responses
- Confirmed idempotency-key requirement in POST handler
- Analyzed rate limiter: window=60000ms, max=600, keyed by IP
