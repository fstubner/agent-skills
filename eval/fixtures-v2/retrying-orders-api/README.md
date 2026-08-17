# Orders API

`src/server.js` exports `createServer()` and uses only Node built-ins. Requests authenticate with `Authorization: Bearer alice` or `Bearer bob`.

- `POST /login` accepts JSON email and password and is publicly reachable.
- `POST /orders` accepts JSON `sku` and positive integer `quantity`, returning an order id. Mobile clients retry timed-out requests with the same `Idempotency-Key`.
- `GET /orders/:id` returns the signed-in account's order.

Errors are JSON. SKU is a non-empty string of at most 40 characters; quantity is at most 100.
