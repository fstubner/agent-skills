# API Documentation Assessment

## Summary
The API documentation in `docs/api.md` contains significant discrepancies with the actual implementation in `src/api.js`. The implementation uses a different API version, different endpoint behaviors, and different rate limiting configuration than documented.

## Detailed Discrepancies

### 1. API Version Mismatch
- **Documentation states**: `/v1/events` endpoints
- **Implementation uses**: `/v2/events` endpoints
- **Impact**: Partners connecting to v1 endpoints will receive 404 errors

### 2. GET Endpoint Pagination
- **Documentation states**: Offset-based pagination with `?page=2` parameter, returns 50 items per page
- **Implementation uses**: Cursor-based pagination with `?after=<id>` parameter, returns 25 items per page
- **Response format difference**:
  - Doc implies: `[{ event }, ...]`
  - Actual: `{ events: [{ event, id }, ...], nextCursor: <id or null> }`
- **Impact**: Partners cannot paginate using `?page` parameter; they must use `?after` cursor-based approach

### 3. POST Endpoint Response Code
- **Documentation states**: Returns `201 Created`
- **Implementation returns**: `202 Accepted`
- **Impact**: Partners expecting 201 status code will treat successful requests as incorrect responses

### 4. POST Endpoint Required Header
- **Documentation**: No mention of required headers beyond `Authorization`
- **Implementation requires**: `idempotency-key` header
- **Implementation returns**: `400 Bad Request` if header is missing
- **Impact**: Partners will receive 400 errors if they don't include the idempotency-key header

### 5. Rate Limit Configuration
- **Documentation states**: 100 requests per minute per token
- **Implementation configured**: 600 requests per minute (max: 600, windowMs: 60_000)
- **Rate limit scope**:
  - Doc implies: Per authentication token
  - Implementation uses: Per IP address (`req.ip`)
- **Impact**: Partners see 6x higher limits than documented; limits apply per-IP, not per-token as documented

## Authentication Verification
- **Documentation requirement**: Bearer token in `Authorization` header required for all endpoints
- **Implementation**: Rate limiting middleware is applied globally, but no explicit authentication validation visible in provided code
- **Note**: Authentication enforcement should be verified in complete middleware chain

## Affected Partners
These discrepancies will cause:
- 404 errors when calling v1 endpoints
- Failed pagination due to incompatible parameter names and response structure
- Unexpected 202 responses instead of 201
- 400 errors on POST requests without `idempotency-key` header
- Misalignment of rate limit expectations and IP-based vs token-based limiting

## Recommendations
The documentation must be updated to match the actual v2 API implementation, or the implementation must be updated to match v1 documentation. Immediate reconciliation is required to resolve partner integration issues.
