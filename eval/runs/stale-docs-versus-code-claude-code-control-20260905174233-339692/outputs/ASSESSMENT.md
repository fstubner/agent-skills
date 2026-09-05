# API Documentation Assessment

## Summary
The API documentation in `docs/api.md` contains multiple significant discrepancies with the actual API implementation in `src/api.js`. Partners receiving the documentation will encounter errors and unexpected behavior.

## Critical Discrepancies

### 1. API Version Mismatch
- **Documented**: `/v1/events` endpoints (GET and POST)
- **Actual Implementation**: `/v2/events` endpoints
- **Impact**: All documented endpoints return 404; partners cannot access the API using provided documentation

### 2. Pagination Method Mismatch
- **Documented**: "50 per page. Use `?page=2` for the second page" (offset-based pagination)
- **Actual Implementation**: Cursor-based pagination using `?after=<id>` parameter
- **Impact**: Partners cannot navigate pages using the documented method; attempts to use `?page=2` will be ignored

### 3. Page Size Mismatch
- **Documented**: 50 events per page
- **Actual Implementation**: 25 events per page (PAGE_SIZE = 25)
- **Impact**: Partners will receive fewer events than expected, potentially incomplete result sets

### 4. POST Response Status Code Mismatch
- **Documented**: Returns `201` with the created event body
- **Actual Implementation**: Returns `202 Accepted` with `{ accepted: true }`
- **Impact**: Partners expecting status 201 and event data will receive wrong status and response format

### 5. Missing Required Header in Documentation
- **Documented**: No mention of required headers for POST endpoint
- **Actual Implementation**: Requires `idempotency-key` header; returns 400 without it
- **Impact**: All POST requests will fail with 400 error if partners don't include this undocumented header

### 6. Rate Limit Value Mismatch
- **Documented**: "100 requests per minute per token"
- **Actual Implementation**: Allows 600 requests per minute (max: 600, windowMs: 60_000)
- **Impact**: Partners may exceed documented limits and receive unexpected 429 responses

### 7. Rate Limit Basis Mismatch
- **Documented**: "per token" (based on Authorization bearer token)
- **Actual Implementation**: Rate limiting is applied per IP address (key = req.ip)
- **Impact**: Multiple tokens from same IP will share the same limit; documentation is misleading about rate limit scoping

### 8. Missing Authentication Details
- **Documented**: "Every endpoint requires a bearer token in the Authorization header. Requests without one receive 401"
- **Actual Implementation**: No authentication middleware visible in code; rate limiting uses IP not tokens
- **Impact**: Authentication behavior not actually enforced; return value (401) doesn't match implementation

## Severity
These discrepancies span multiple critical areas: API version, data format, response codes, required headers, and rate limiting behavior. Partners following the documentation will be unable to successfully use the API.
