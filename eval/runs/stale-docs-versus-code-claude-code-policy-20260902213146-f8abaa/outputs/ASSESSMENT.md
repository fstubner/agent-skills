# API Documentation Assessment

## Summary
The API documentation (`docs/api.md`) does not match the actual implementation (`src/api.js`). Partners receive outdated or incorrect documentation, leading to integration failures.

## Critical Discrepancies

### 1. **API Version Mismatch**
- **Documented**: `/v1/events` (GET and POST)
- **Implemented**: `/v2/events` (GET and POST)
- **Impact**: Partners attempt to call the wrong endpoints, receiving 404 errors

### 2. **GET /events Pagination**
- **Documented**: Offset-based pagination with 50 items per page (`?page=2` for second page)
- **Implemented**: Cursor-based pagination with 25 items per page (`?after=<id>` returns page following that id)
- **Impact**: Partners cannot iterate through results as documented; pagination parameters are incompatible

### 3. **POST /events Response and Behavior**
- **Documented**: Returns `201` with the created event body
- **Implemented**: Returns `202` with `{ accepted: true }` (no event data)
- **Impact**: Partners expecting the created event object receive an acceptance confirmation instead, breaking downstream logic

### 4. **POST /events Headers Requirements**
- **Documented**: No mention of required headers
- **Implemented**: Requires `idempotency-key` header; requests without it receive `400 Bad Request`
- **Impact**: Partners' POST requests fail unexpectedly without this undocumented header

### 5. **Rate Limiting: Key Type Mismatch**
- **Documented**: "100 requests per minute per token"
- **Implemented**: 600 requests per 60 seconds (10/sec), applied per **IP address**, not per token
- **Impact**: Rate limiting strategy is fundamentally different; token-based rate limiting not implemented at all

### 6. **Authentication: Not Implemented**
- **Documented**: "Every endpoint requires a bearer token in the `Authorization` header. Requests without one receive `401`"
- **Implemented**: No authentication middleware present; all endpoints accept requests without validation
- **Impact**: Critical security gap; API is open to unauthorized access despite documentation promising authentication

## Verification Method
- Examined `/docs/api.md` for published API contract
- Analyzed `src/api.js` for actual middleware, routes, and response formats
- Compared endpoint paths, pagination strategies, response codes, headers, and rate limiting logic
- Confirmed rate limiting implementation in `src/limit.js` uses IP-based keying (line 4)

## Recommendation
Update `docs/api.md` to match the actual implementation, or vice versa. The current state will cause integration failures and security concerns for partners attempting to follow the documentation.
