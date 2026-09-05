# API Documentation Assessment

## Summary

The API documentation in `docs/api.md` describes a v1 API with specific behaviors that do not match the actual implementation in `src/api.js`. The implementation provides a v2 API with significantly different endpoints, response formats, headers, pagination, and rate limiting.

## Critical Discrepancies

### 1. API Version
- **Documentation claims**: `/v1/events`
- **Actual implementation**: `/v2/events`
- **Impact**: Partners attempting to call documented endpoints will get 404 errors.

### 2. Pagination Strategy
- **Documentation claims**: Offset-based pagination using `?page=2` parameter
- **Actual implementation**: Cursor-based pagination using `?after=<id>` parameter
- **Impact**: Partners cannot use documented pagination method; requires integration changes.

### 3. GET Response Format
- **Documentation claims**: Returns events (50 per page)
- **Actual implementation**: Returns `{"events": [...], "nextCursor": ...}` with 25 per page
- **Impact**: Partners must handle different response structure and page size.

### 4. POST Response
- **Documentation claims**: Returns `201` with the created event body
- **Actual implementation**: Returns `202` with `{"accepted": true}`
- **Impact**: Partners cannot retrieve the created event from the response; different HTTP status code indicates different semantics (accepted vs. created).

### 5. Authentication
- **Documentation claims**: Bearer token in `Authorization` header required; missing token returns `401`
- **Actual implementation**: No authentication validation; instead requires `idempotency-key` header
- **Impact**: Partners cannot authenticate as documented; requests succeed without auth header; required header is missing from docs.

### 6. Rate Limiting
- **Documentation claims**: 100 requests per minute per token
- **Actual implementation**: 600 requests per minute per IP
- **Impact**: 
  - Different limit (600 vs 100)
  - Different scope (per IP instead of per token)
  - No per-token tracking implemented

## Implementation Details

**src/api.js**:
- Endpoints at `/v2/events` (lines 11, 17)
- Rate limiting configured to `max: 600` per `windowMs: 60_000` (line 8)
- Rate limiting key is `req.ip` (src/limit.js, line 4)
- POST requires `idempotency-key` header; returns 202 (line 18-19)
- GET uses cursor pagination with `after` parameter (line 12)
- Page size is 25 (line 3)

**docs/api.md**:
- Documents `/v1/events` endpoints
- Describes `?page=2` pagination
- Documents 201 response with event body
- Documents 100 requests/minute rate limit per token
- Documents bearer token authentication

## Verification

Verified by:
1. Reading `docs/api.md` to extract documented API contract
2. Reading `src/api.js` to inspect actual endpoint implementations
3. Reading `src/limit.js` to verify rate limiting behavior
4. Cross-referencing response formats, HTTP status codes, required headers, and pagination methods between documentation and code
