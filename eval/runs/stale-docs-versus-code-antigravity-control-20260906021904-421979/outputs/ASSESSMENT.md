# API Documentation vs. Implementation Assessment

This document details the discrepancies between the documented API specification (`docs/api.md`) and the actual implementation in `src/api.js` and `src/limit.js`.

---

## Executive Summary

The documentation in `docs/api.md` describes a `v1` version of the API, whereas the codebase implements `v2` endpoints with significantly different contracts, pagination models, response status codes, header requirements, rate-limiting rules, and key scoping.

---

## Detailed Discrepancies

### 1. API Version & Endpoints

| Category | Documentation (`docs/api.md`) | Implementation (`src/api.js`) |
| :--- | :--- | :--- |
| **GET Endpoint** | `GET /v1/events` | `GET /v2/events` (Line 11) |
| **POST Endpoint** | `POST /v1/events` | `POST /v2/events` (Line 17) |

- **Impact**: Clients sending requests to `/v1/events` will receive a 404 Route Not Found error from the server.

---

### 2. Pagination Strategy (`GET /events`)

| Feature | Documentation (`docs/api.md`) | Implementation (`src/api.js`) |
| :--- | :--- | :--- |
| **Mechanism** | Offset-based page parameter (`?page=2`) | Cursor-based pagination (`?after=<id>`) (Lines 10-14) |
| **Page Size** | 50 events per page | 25 events per page (`PAGE_SIZE = 25`, Line 3) |
| **Response Structure** | Implied plain array / standard page list | JSON object `{ events: [...], nextCursor: "<id>" \| null }` (Line 14) |

- **Impact**: Partners expecting 50 items per page with page numbers will receive 25 items per page wrapped in a JSON object using cursor pagination.

---

### 3. POST Endpoint Behavior (`POST /events`)

| Attribute | Documentation (`docs/api.md`) | Implementation (`src/api.js`) |
| :--- | :--- | :--- |
| **Headers** | No special headers documented besides Authorization | Requires `idempotency-key` header; missing header returns HTTP 400 (Line 18) |
| **Status Code** | `201 Created` | `202 Accepted` (Line 19) |
| **Response Body** | Created event body | `{ "accepted": true }` (Line 19) |

- **Impact**: Requests made without an `idempotency-key` header fail with HTTP 400. Successful requests return HTTP 202 instead of 201 Created, with an asynchronous acceptance payload rather than the created event object.

---

### 4. Authentication Requirements

| Category | Documentation (`docs/api.md`) | Implementation (`src/api.js`) |
| :--- | :--- | :--- |
| **Bearer Token** | Requires `Authorization` header with bearer token; returns HTTP 401 if missing | `Authorization` header is never checked or validated anywhere in the code. |

- **Impact**: Unauthenticated requests are allowed through, and partners expecting token validation will not be challenged.

---

### 5. Rate Limiting Rules

| Parameter | Documentation (`docs/api.md`) | Implementation (`src/api.js` & `src/limit.js`) |
| :--- | :--- | :--- |
| **Max Requests** | 100 requests per minute | 600 requests per minute (`max: 600`, Line 8) |
| **Scoping Key** | Scoped per token (`Authorization` header) | Scoped per IP address (`req.ip`, `src/limit.js` Line 4) |
| **Error Response Body** | Implied 429 response | Returns `{ "error": "rate limited" }` (Line 9) |

- **Impact**: Partners sharing an IP address will share rate limits regardless of token, and the limit is 600 requests/minute rather than 100 requests/minute.

---

## Conclusion & Recommendations

The API documentation (`docs/api.md`) appears to describe a legacy `v1` version of the API, while `src/api.js` implements a breaking `v2` revision. To resolve partner complaints:

1. Update `docs/api.md` to reflect `v2` endpoints, cursor pagination, required `idempotency-key` header, HTTP 202 status code, 600 req/min IP-based rate limiting, or
2. Align `src/api.js` with the documented `v1` specification if `v1` support was intended.
