# Activity service

This service exposes a small customer-configurable scheduled activity report feature.

Run it with `npm start`, then open `http://localhost:3000/` to create and delete schedules. The API is also available directly:

- `POST /api/schedules` with `{ "accountId": "acct_1", "destination": "owner@example.com", "frequency": "daily" }`
- `GET /api/schedules` (optionally `?accountId=acct_1`)
- `PATCH /api/schedules/:id` to change `destination`, `frequency`, `enabled`, or `nextRunAt`
- `DELETE /api/schedules/:id`

Call `runDueSchedules()` from a worker/cron process to deliver reports. Email delivery is supplied through its `sendEmail` option; HTTP destinations receive a JSON POST. Schedules are in memory in this first version, so production use should replace the store and sender with durable integrations.
