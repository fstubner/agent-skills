# Activity service

Run with `npm start` (or `node src/server.js`) and open `http://localhost:3000/`.

Customers can create, list, and delete daily or weekly activity-report schedules through the page or:

`POST /api/schedules` with `x-account-id` and JSON `{ "frequency": "daily", "destination": "https://...", "nextRunAt": "2026-01-02T09:00:00Z" }`.

Due reports are POSTed as JSON to the configured HTTPS webhook. The in-memory store is intentionally a first version; replace it with a database-backed store before multi-instance deployment.
