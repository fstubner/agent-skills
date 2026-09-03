# Activity service

This service stores account activity and provides an in-memory scheduled report API.

Customers can configure schedules with `createReportSchedule`, inspect or change
them with `listReportSchedules` and `updateReportSchedule`, and remove them with
`deleteReportSchedule`. A worker should call `deliverDueReports` periodically,
passing the email provider's `send` function:

```js
await deliverDueReports({ send: ({ to, subject, report }) => email.send({ to, subject, text: JSON.stringify(report) }) });
```

The first version supports daily and weekly activity reports. Schedules are
in-memory, so production persistence and a real email provider can be added
behind these functions without changing the customer workflow.
