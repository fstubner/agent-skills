# API Documentation Assessment

## Summary

The published API documentation (`docs/api.md`) contains multiple significant discrepancies with the actual implementation in `src/api.js`. Partners using the documented endpoints will encounter failures due to these mismatches.

## Critical Discrepancies

### 1. **API Version Mismatch**
- **Documented**: `/v1/events`
- **Actual**: `/v2/events`
- **Impact**: Partners calling `/v1/events` will receive 404 responses. All documented examples are incorrect.

### 2. **Pagination Method**
- **Documented**: Page-based pagination with `?page=2` parameter
- **Actual**: Cursor-based pagination with `?after=<id>` parameter
- **Impact**: Partners cannot navigate through results using the documented method. The response format also differs - code returns `{ events: [], nextCursor: null }` not a simple array.

### 3. **Page Size**
- **Documented**: 50 events per page
- **Actual**: 25 events per page
- **Impact**: Partners expecting 50 results per request will receive only 25, affecting pagination logic.

### 4. **POST Response Status Code**
- **Documented**: Returns `201` (Created)
- **Actual**: Returns `202` (Accepted)
- **Impact**: Partners checking for 201 status code will fail to properly handle successful submissions.

### 5. **POST Required Header**
- **Documented**: No mention of required headers beyond authorization
- **Actual**: Requires `idempotency-key` header; returns `400` if missing
- **Impact**: Partners cannot successfully POST without this undocumented header.

### 6. **Rate Limit**
- **Documented**: 100 requests per minute
- **Actual**: 600 requests per minute (configured as `max: 600` with 60-second window)
- **Impact**: Partners implementing client-side rate limiting based on documentation will be overly restrictive by 6x.

### 7. **Authentication Implementation**
- **Documented**: "Every endpoint requires a bearer token in the Authorization header. Requests without one receive 401."
- **Actual**: No authentication validation in the code; rate limiting is applied per IP address regardless of authentication
- **Impact**: Partners sending requests without authorization headers will still be served (rate-limited by IP only). The 401 response mentioned in docs is not implemented.

## Severity

All discrepancies are breaking changes that prevent partners from successfully using the API as documented. The endpoint paths alone make the documentation unusable.

## Recommendations

The documentation requires comprehensive updates to reflect the actual API implementation before partners can integrate successfully.
