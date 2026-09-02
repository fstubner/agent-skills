# Operations

## Signals
`GET /healthz` returns 200 with a `{db}` sub-check. Structured JSON logs go
to stdout; every line carries `request_id`, propagated from `X-Request-Id`.

## Alerts
5xx rate above 2% over 5 minutes pages on-call; first response is to check
`/healthz` and then roll back per Recovery. Queue depth above 10k for 15
minutes opens a ticket rather than paging.

## Failure modes
The OKR list query degrades before error rate moves — latency climbs while
health stays green. A stale deploy marker leaves the UI showing last week's
quarter with no error at all.

## Recovery
Roll back: `npm run deploy:rollback` — safe, no data loss. Restart:
`systemctl restart okr-api` — in-flight writes are retried and may duplicate
without an idempotency key.
