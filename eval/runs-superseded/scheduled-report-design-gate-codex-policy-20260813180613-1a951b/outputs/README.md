# Activity service

This service stores account activity and provides a first version of scheduled report delivery.

Run it with `npm start`, then open `http://localhost:3000`. The UI lets an account create daily or weekly schedules and manage its own schedules.

The API uses `x-account-id` for account scoping (replace this with the service's real authenticated account context when one exists):

- `GET /api/schedules`
- `POST /api/schedules` with `{ "report": "Activity summary", "frequency": "daily", "recipients": ["you@example.com"] }`
- `PATCH /api/schedules/:id` to edit a schedule
- `DELETE /api/schedules/:id` to pause it

`dueSchedules()` is the worker-facing handoff: it returns enabled schedules whose `nextRunAt` has arrived and advances them. Actual email/provider delivery is intentionally left to the caller.
