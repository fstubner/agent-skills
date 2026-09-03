# Activity service

This service exposes scheduled activity reports. Schedules are currently held in
memory, so they are intended for the first version and are lost on restart.

Run `npm test` to verify the library. To expose the configuration page/API:

```js
import { createApp, startScheduler } from './src/server.js';
createApp().listen(3000);
startScheduler();
```

Customers can use `GET /` to create schedules. The JSON API is:

- `POST /api/schedules` with `{accountId, channel, destination, frequency, time, dayOfWeek}`
- `GET /api/schedules?accountId=...`
- `DELETE /api/schedules/:id?accountId=...`

Times are UTC. `channel` is `email` or `webhook`; delivery is routed through
the injectable `deliver` function in `runDueSchedules`, ready to connect to a
provider without changing schedule behavior.
