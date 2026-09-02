# API Documentation vs Implementation Assessment

## Summary
Partners are receiving responses that significantly differ from the published API documentation. The discrepancies span API versioning, authentication, rate limiting, pagination, response codes, and undocumented requirements.

## Critical Discrepancies

### 1. API Version Mismatch
- **Documentation**: Specifies `/v1/events` endpoints
- **Implementation**: Routes are at `/v2/events`
- **Impact**: Partners using documented v1 endpoints will receive 404 errors

### 2. Missing Authentication Implementation
- **Documentation**: "Every endpoint requires a bearer token in the `Authorization` header. Requests without one receive `401`."
- **Implementation**: No authentication check is implemented. No bearer token validation exists. The `/v2/events` endpoints do not require or validate any Authorization header.
- **Impact**: Authentication security model described in docs is not enforced; undocumented access control

### 3. Rate Limiting: Key Dimension Wrong
- **Documentation**: "100 requests per minute per token"
- **Implementation**: 
  - Rate limit key is `req.ip` (per IP address), not per token
  - Rate limit values: `max: 600` requests per `windowMs: 60_000` ms = 10 requests/second (600/min)
- **Impact**: Rate limiting is applied per IP address, not per authentication token as documented. Effective limit is 6x higher (600/min vs 100/min)

### 4. GET Endpoint Pagination Model Changed
- **Documentation**: "Returns events, 50 per page. Use `?page=2` for the second page."
- **Implementation**:
  - Uses cursor-based pagination with `?after=<id>` parameter, not offset-based `?page=2`
  - Page size is 25 items per page, not 50
  - Response format: `{ events: page, nextCursor: ... }` (not documented)
  - The `nextCursor` field is `null` or the last event's ID, indicating the pagination mechanism
- **Impact**: Partners using `?page=2` will get unexpected results. API response structure is different from documented

### 5. POST Endpoint Response Status Changed
- **Documentation**: "Accepts an event and returns `201`"
- **Implementation**: Returns `202 (Accepted)` status code
- **Impact**: HTTP status semantics differ; `202` indicates asynchronous acceptance vs `201` (Created) for synchronous creation

### 6. POST Endpoint Undocumented Requirement
- **Documentation**: Silent on request headers
- **Implementation**: Requires `idempotency-key` header; requests without it receive `400` error with message `"idempotency-key header required"`
- **Impact**: Partners following documented API will receive 400 errors; critical header not mentioned in docs

## Root Cause Analysis

The discrepancies suggest that:
1. Implementation has been updated to v2 API (cursor pagination, 202 status, idempotency header) but documentation was not updated
2. Authentication layer was planned but never implemented
3. Rate limiting mechanism was changed from per-token to per-IP but documentation was not updated

## Verification Performed

- ✓ Examined API documentation (`docs/api.md`)
- ✓ Examined API implementation (`src/api.js`)
- ✓ Examined rate limiting middleware (`src/limit.js`)
- ✓ Examined unit tests (`test/limit.test.js`) - confirms rate limiting uses IP address as key
- ✓ Verified rate limit configuration: 600 requests per 60,000ms (60 seconds) = 10 req/sec
- ✓ Verified pagination implementation: cursor-based with 25-item page size
- ✓ Verified POST endpoint: returns 202, requires idempotency-key header
- ✓ Verified authentication: no bearer token validation implemented

## Recommendations for Partners

Until documentation is updated to match implementation, partners should:
1. Target `/v2/events` endpoints, not `/v1/events`
2. Use cursor-based pagination with `?after=<id>` instead of `?page=2`
3. Expect 25 items per page, not 50
4. Expect `202` response from POST, not `201`
5. Include `idempotency-key` header in POST requests
6. Be aware that rate limits are per IP address (600/min), not per token (100/min)
7. Do not rely on authentication enforcement; bearer tokens are not validated
