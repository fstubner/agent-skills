# Activity service

The service exposes a small scheduled-report API and a browser setup page.

Run it with `PORT=3000 npm start`, then open `http://localhost:3000`.

API:

- `POST /api/schedules` with `{ "accountId", "recipient", "frequency": "daily"|"weekly", "format": "csv"|"json" }`
- `GET /api/schedules?accountId=...`
- `DELETE /api/schedules/:id`
- `POST /api/run-due` runs due schedules (a production process should call this endpoint from a cron job).

Schedules and deliveries are in memory in this first version. `runDueSchedules` accepts a delivery function, making it straightforward to connect an email provider later.
