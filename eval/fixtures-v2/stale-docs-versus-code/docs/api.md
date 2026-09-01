# Events API

## Authentication

Every endpoint requires a bearer token in the `Authorization` header. Requests
without one receive `401`.

## GET /v1/events

Returns events, 50 per page. Use `?page=2` for the second page.

## POST /v1/events

Accepts an event and returns `201` with the created event body.

## Rate limits

100 requests per minute per token. Exceeding the limit returns `429`.
