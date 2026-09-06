# Assessment of API Documentation vs Implementation Discrepancies

## Summary of Findings

A systematic audit comparing `docs/api.md` against the actual service implementation in `src/api.js` and `src/limit.js` reveals critical discrepancies across versioning, authentication, endpoints, pagination, status codes, and rate limiting parameters.

---

## Detailed Discrepancies

### 1. API Versioning & Endpoints
- **Documented (`docs/api.md`)**:
  - `GET /v1/events`
  - `POST /v1/events`
- **Implemented (`src/api.js`)**:
  - `GET /v2/events` (line 11)
  - `POST /v2/events` (line 17)
- **Impact**: Any partner attempting to call `/v1/*` endpoints documented in the specification will receive a `404 Not Found` response.

---

### 2. Authentication Enforcement
- **Documented (`docs/api.md`)**:
  - Requires a bearer token in the `Authorization` header on every endpoint. Returns `401` if omitted.
- **Implemented (`src/api.js`)**:
  - No authentication middleware or header check is configured. Requests pass without checking `Authorization` headers.
- **Impact**: Unauthenticated requests are processed, and invalid/missing bearer tokens are not rejected with `401`.

---

### 3. GET /events Pagination Model & Page Size
- **Documented (`docs/api.md`)**:
  - Offset/page-based pagination: `50 per page`, using query parameter `?page=2`.
- **Implemented (`src/api.js`)**:
  - Cursor-based pagination: Page size is fixed to `25` (`PAGE_SIZE = 25`, line 3).
  - Uses query parameter `?after=<id>` (line 12) and returns a response payload containing `{ events, nextCursor }` (line 14).
- **Impact**: Partners expecting 50 items per page will receive 25. Partners passing `?page=N` will find pagination parameters ignored.

---

### 4. POST /events Ingestion & Headers
- **Documented (`docs/api.md`)**:
  - Accepts event payload, returns `201 Created` with the created event body.
- **Implemented (`src/api.js`)**:
  - Requires a mandatory `idempotency-key` header (line 18), returning `400` if absent.
  - Returns `202 Accepted` with `{ accepted: true }` body (line 19) instead of `201 Created`.
- **Impact**: Requests without `idempotency-key` fail with `400 Bad Request`. Successful requests receive `202 Accepted` rather than `201 Created`.

---

### 5. Rate Limiting Strategy & Thresholds
- **Documented (`docs/api.md`)**:
  - Limit: `100 requests per minute per token`.
- **Implemented (`src/api.js` & `src/limit.js`)**:
  - Limit: `600 requests per minute` (`windowMs: 60000, max: 600`, line 8).
  - Identification: Rate limiting is keyed by IP address (`req.ip`, `src/limit.js` line 4) rather than by token.
- **Impact**: Multi-tenant systems or partners behind shared IP proxies will share rate limits unexpectedly. The threshold is 600 req/min/IP instead of 100 req/min/token.

---

## Summary Matrix

| Feature / Aspect | Documented (`docs/api.md`) | Implemented (`src/api.js` / `src/limit.js`) |
| :--- | :--- | :--- |
| **API Version** | `/v1/events` | `/v2/events` |
| **Authentication** | Bearer token required (401 on missing) | None implemented |
| **GET Pagination** | Offset-based (`?page=N`), 50 items/page | Cursor-based (`?after=ID`), 25 items/page |
| **POST Requirements** | Standard JSON body | Requires `idempotency-key` header |
| **POST Response** | `201 Created` + event object | `202 Accepted` + `{ accepted: true }` |
| **Rate Limit Threshold** | 100 req / minute | 600 req / minute |
| **Rate Limit Identifier** | Per Token | Per IP address (`req.ip`) |
