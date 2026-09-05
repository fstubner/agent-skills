# API Documentation Assessment

## Summary

The API documentation (`docs/api.md`) provided to partners contains **10 significant discrepancies** with the actual implementation (`src/api.js`). These mismatches will cause partner integrations to fail and create support friction.

## Critical Mismatches

### 1. API Version Mismatch
- **Documented**: `/v1/events`
- **Actual**: `/v2/events`
- **Impact**: Requests to documented endpoints receive 404 errors

### 2. Page Size Mismatch
- **Documented**: "50 per page"
- **Actual**: 25 per page (`PAGE_SIZE = 25` in src/api.js:3)
- **Impact**: Partners expecting 50 items per page receive only 25

### 3. Pagination Mechanism Mismatch
- **Documented**: Query parameter `?page=2` for the second page (offset-based pagination)
- **Actual**: Cursor-based pagination with `?after=<id>` query parameter (src/api.js:11)
- **Impact**: Partners cannot use documented pagination method; requires different implementation

### 4. GET Response Format Not Documented
- **Actual response**: `{ events: page, nextCursor: <id|null> }`
- **Documented response**: No format specified
- **Impact**: Partners cannot parse the response without trial-and-error

### 5. POST Status Code Mismatch
- **Documented**: Returns `201` (Created)
- **Actual**: Returns `202` (Accepted) (src/api.js:19)
- **Impact**: Partners' error handling may fail on 202 responses

### 6. POST Response Format Not Documented
- **Actual response**: `{ accepted: true }`
- **Documented response**: "returns 201 with the created event body"
- **Impact**: No `created event body` is actually returned

### 7. Required Header Missing from Documentation
- **Documented**: No mention of required headers
- **Actual**: POST requires `idempotency-key` header (src/api.js:18)
- **Actual behavior**: Missing header returns `400` with error: `{ error: "idempotency-key header required" }`
- **Impact**: All POST requests from undocumented clients will fail with 400 errors

### 8. Authentication Not Actually Implemented
- **Documented**: "Every endpoint requires a bearer token in the Authorization header. Requests without one receive 401"
- **Actual**: No authentication validation in the code (src/api.js shows no auth middleware or checks)
- **Impact**: 
  - The documented security model is not enforced
  - Partners will discover they don't need tokens, creating inconsistent expectations
  - Unauthenticated access is allowed

### 9. Rate Limiting Mechanism Mismatch
- **Documented**: "100 requests per minute per token"
- **Actual**: 600 requests per minute per IP address (src/api.js:8, src/limit.js:1-12)
- **Impact**: 
  - Rate limiting is 6x higher than documented (600 vs 100)
  - Rate limiting is per IP, not per token
  - Partners relying on the documented limit will get unexpected behavior

### 10. Rate Limit Response Not Documented
- **Actual response**: `{ error: "rate limited" }` (src/limit.js:9)
- **Documented response**: No format specified
- **Impact**: Partners have no guidance on error handling

## Summary by Category

| Category | Documented | Actual |
|----------|-----------|--------|
| API Version | `/v1/events` | `/v2/events` |
| Page Size | 50 | 25 |
| Pagination | `?page=2` | `?after=<id>` |
| GET Response | Not specified | `{ events, nextCursor }` |
| POST Status | 201 | 202 |
| POST Response | Event body | `{ accepted: true }` |
| Auth Check | Bearer token required | Not implemented |
| Rate Limit | 100/min per token | 600/min per IP |
| Idempotency Key | Not mentioned | Required |
| Error Response | Not documented | JSON with error field |

## Recommendations

1. **Immediate**: Update documentation to match actual behavior for each endpoint
2. **Verify**: Test all endpoints against documentation before publishing partner guidance
3. **Process**: Add documentation as part of feature acceptance criteria
4. **Testing**: Consider adding integration tests that validate API behavior against documented specifications

## Verification Completed

- ✓ Reviewed `src/api.js` implementation details
- ✓ Reviewed `src/limit.js` rate limiting implementation
- ✓ Reviewed `docs/api.md` documented contract
- ✓ Compared endpoint routes, response formats, status codes, parameters, and headers
- ✓ Verified rate limiting configuration and behavior
- ✓ Confirmed absence of authentication validation in code
- ✓ Ran test suite successfully (npm test passes)
