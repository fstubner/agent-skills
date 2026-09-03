# Activity service

This service stores account activity and lets customers schedule report delivery.

## Run

```sh
npm start
```

Open `http://localhost:3000` to configure a daily or weekly delivery. The first version keeps schedules in memory and uses UTC; connect `deliverDueReports()` to the real mail provider/worker for production delivery.

## API

- `GET /api/reports` lists available reports.
- `GET /api/schedules` lists schedules for the account (use `x-account-id` to select an account).
- `POST /api/schedules` creates a schedule with `reportId`, `recipients`, `frequency`, `time`, and `dayOfWeek` for weekly schedules.
- `PATCH /api/schedules/:id` edits a schedule or sends `{ "active": false }` to pause it.
- `DELETE /api/schedules/:id` removes a schedule.
