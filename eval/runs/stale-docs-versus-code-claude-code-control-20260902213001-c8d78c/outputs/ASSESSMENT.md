# API Documentation Assessment

## Summary
The API documentation (`docs/api.md`) has significant discrepancies with the actual implementation in `src/api.js`. Partners following the documented API will encounter multiple failures due to endpoint versions, pagination methods, response formats, and authentication/rate limiting mechanisms differing from what is implemented.

## Critical Discrepancies

### 1. API Version Mismatch
- **Documented**: Endpoints at `/v1/events` (both GET and POST)
- **Actual**: Endpoints at `/v2/events` (both GET and POST)
- **Impact**: Partners calling the documented endpoints will receive 404 errors.

### 2. Pagination Method
- **Documented**: Offset-based pagination using `?page=2` for the second page
- **Actual**: Cursor-based pagination using `?after=<id>` parameter
- **Actual Response**: Returns `{ events: [...], nextCursor: <id|null> }` instead of a simple array
- **Impact**: Partners cannot retrieve additional pages using the documented pagination method.

### 3. Page Size
- **Documented**: 50 events per page
- **Actual**: 25 events per page
- **Impact**: Partners expecting 50 results per page will get only 25.

### 4. POST /events Response
- **Documented**: Returns `201` status with the created event body
- **Actual**: Returns `202` (Accepted) status with `{ accepted: true }`
- **Documented Behavior**: Accept an event object in the request body and return it
- **Actual Behavior**: Requires an `idempotency-key` header, returns no event data
- **Impact**: Partners will receive unexpected status codes and response formats.

### 5. Idempotency Key Requirement
- **Documented**: No mention of required headers
- **Actual**: Requires `idempotency-key` header in POST requests; returns `400` if missing
- **Impact**: Partners will encounter 400 errors if they don't know about this requirement.

### 6. Rate Limiting
- **Documented**: 100 requests per minute per token
- **Actual**: 600 requests per minute per IP address (configuration: `windowMs: 60_000, max: 600`)
- **Impact**: Rate limiting is based on IP address, not authentication token, contradicting the documented per-token limitation.

### 7. Authentication Verification
- **Documented**: Every endpoint requires a bearer token in the `Authorization` header; requests without one receive `401`
- **Actual**: No authentication middleware is implemented; requests are rate-limited by IP only
- **Impact**: Partners may assume their requests are authenticated when they are not; authentication is not enforced.

## Verified Items
- Rate limit error responses use `429` status code (matches documentation)
- HTTP endpoints structure follows the documented pattern (GET for retrieval, POST for creation)
- Bearer token authentication claim verified to be unimplemented (critical gap)
