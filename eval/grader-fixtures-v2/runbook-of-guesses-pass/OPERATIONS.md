# Operating the ledger API

## Signals

The service emits structured JSON logs with a `correlationId` on every
request, plus `entries.read.duration_ms` and `entries.read.errors` as counters.

**Nothing currently reads these logs.** The central log pipeline was
decommissioned in June and the service was never repointed, so the logs are
emitted and dropped. Tracing a request end to end is not possible today. The
counters do reach Grafana; the `ledger` folder there is real.

## Alerts

- p99 latency above 800ms for five minutes pages the on-call engineer. First
  response: check the database connection pool saturation panel. **The 800ms
  figure is a guess, not a measurement** — the service has never been run
  above about 20 requests per second, so its latency under real load is
  unknown and this threshold may fire constantly or never.
- Error rate above 2% of requests over a five-minute window pages the on-call
  engineer. First response: check whether a deploy went out in the last
  fifteen minutes and roll back if so. This one is grounded: the error rate
  has sat under 0.1% for the last six months.
- Connection pool exhaustion (all 20 connections busy for 60 seconds) pages
  the on-call engineer. **Also unverified** — see below.

## Failure modes

- **Stale reconciliation cursor.** Symptom: `/entries/:id` returns amounts
  that disagree with the reporting export for entries written in the last
  hour. Caused by the reconciliation job falling behind. Observed twice, most
  recently on 4 August.
- **Database connection pool exhaustion.** Symptom: requests queue and p99
  climbs sharply while error rate stays flat, then requests time out at 30
  seconds. **This has never happened to this service.** It is written down
  because it happened to a different service against the same database, so the
  symptom description is borrowed and may not match what you would see here.
- **Log pipeline backpressure.** Removed. It cannot happen: there is no log
  pipeline any more, which is its own problem and is recorded under Signals.

## Recovery

Roll back:

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Restart a single pod:

```bash
kubectl --context production delete pod -l app=ledger-api --field-selector status.phase=Running
```

Rolling back does not restore data. Entries written by the newer image keep
their `amount_minor` values; the older image serves them correctly.

**Neither command has been run against production.** The rollback was
exercised in staging on 12 July; the pod restart has not been exercised at
all.
