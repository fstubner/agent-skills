# API Documentation Assessment

## Summary

The API documentation in `docs/api.md` contains significant mismatches with the actual implementation in `src/api.js`. There are 8 major discrepancies across endpoints, pagination, response codes, and rate limiting that would cause integration failures for partners.

## Detailed Findings

### 1. API Version Mismatch
**Documentation:** `/v1/events`  
**Implementation:** `/v2/events`  
**Impact:** Partners connecting to v1 will receive 404 errors. This is the most critical mismatch.

### 2. Pagination Type and Page Size
**Documentation:** Page-based pagination using `?page=2` for the second page; 50 items per page  
**Implementation:** Cursor-based pagination using `?after=<id>` for offset; 25 items per page (`PAGE_SIZE = 25`)  
**Impact:** Partners cannot use page numbers. The response structure also changed to return `{ events: [...], nextCursor: "..." }` instead of a flat array.

### 3. GET /events Response Format
**Documentation:** Returns events directly  
**Implementation:** Returns object with `events` array and `nextCursor` field  
**Impact:** Partners expecting a direct array will fail when parsing the response.

### 4. POST /events Response Code
**Documentation:** Returns `201` (Created)  
**Implementation:** Returns `202` (Accepted)  
**Impact:** Partners checking response status codes will receive unexpected status. The semantic difference (created vs. accepted) also suggests asynchronous processing rather than immediate creation.

### 5. POST /events Required Header
**Documentation:** No mention of required headers beyond `Authorization`  
**Implementation:** Requires `idempotency-key` header; returns 400 if missing  
**Impact:** Partners will receive 400 errors if they don't include this undocumented header. This is a breaking requirement not documented.

### 6. Rate Limiting - Requests Per Minute
**Documentation:** 100 requests per minute per token  
**Implementation:** 600 requests per minute per IP address (`windowMs: 60_000, max: 600`)  
**Impact:** The limit is 6x higher than documented. More critically, rate limiting is applied per IP address, not per authentication token. Partners using shared infrastructure will hit the limit faster than expected.

### 7. Rate Limiting - Key Type
**Documentation:** Per token  
**Implementation:** Per IP address (`req.ip`)  
**Impact:** Rate limiting doesn't account for multiple services or environments sharing an IP. This means partners behind a corporate proxy or cloud NAT share a rate limit quota.

### 8. Authentication Enforcement
**Documentation:** Every endpoint requires bearer token; 401 without one  
**Implementation:** No authentication validation present in the middleware stack  
**Impact:** The API does not enforce the documented authentication requirement. Partners can make requests without a token.

## Severity Assessment

| Issue | Severity | Reason |
|-------|----------|--------|
| API version (/v1 vs /v2) | **Critical** | Complete integration failure |
| Pagination (page vs cursor) | **Critical** | Cannot navigate results correctly |
| POST status code (201 vs 202) | **High** | Status-based error handling breaks |
| Missing idempotency-key | **High** | Returns unexpected 400 errors |
| Response format change | **High** | JSON parsing fails |
| Rate limit per IP not token | **Medium** | Unexpected throttling in shared infra |
| Rate limit 600 vs 100 | **Medium** | Quota expectations mismatch |
| Missing auth enforcement | **Medium** | Security and access control not enforced |

## Recommended Actions

1. **Immediate:** Update documentation to reflect all current implementation details before partners encounter more failures
2. **Clarify:** Determine whether the implementation or documentation reflects the intended design
3. **Versioning:** If v1 API still needs to be supported, the implementation should serve both v1 and v2 endpoints with different behaviors
4. **Testing:** Add integration tests that validate documentation against actual API responses
