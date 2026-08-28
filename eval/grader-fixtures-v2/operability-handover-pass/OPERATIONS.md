# Operations — dispatch API

Written for the on-call rota, who did not build this.

## Signals

`GET /healthz` returns 200 with `{drivers, assignQueue}`; it returns 503 when
the assign loop has been waiting longer than 30s, which is the only way the
hang below is visible from outside.

Logs are JSON to stdout, one object per line, shipped to Loki. Every line
carries `request_id` (from `X-Request-Id`, generated when absent), `job_id`
and `region`, so a driver complaint can be traced from the job id to the
assignment attempt.

Not yet instrumented: assignment latency has no histogram, so "slow" is
currently only visible as a rising queue depth rather than a percentile.

## Alerts

- `/healthz` returning 503 on any replica for 2 minutes → pages on-call.
  First response: check `assignQueue` depth in the health payload, then
  restart that replica per Recovery.
- 5xx rate above 2% over 5 minutes → pages on-call. First response: roll
  back per Recovery; the last deploy is the usual cause.
- Assign queue depth above 100 for 15 minutes → ticket, not a page. It is a
  demand signal rather than a fault.

## Failure modes

- **The assign loop never returns.** `src/assign.js` retries for a free
  driver forever with no cap. During a regional driver shortage the request
  hangs rather than failing, so the symptom is rising open connections and
  climbing queue depth while error rate stays flat and health stays green
  until the 30s threshold trips. This is the failure this service is most
  likely to have.
- **A replica holds stale driver state.** `DRIVERS` is in-process, so a
  restarted replica starts empty and assigns differently from its peers.
  Symptom: the same job assigned twice across replicas.
- **Rollout replaces all three replicas.** A bad image takes the whole
  service; there is no canary today.

## Recovery

- Roll back: `kubectl rollout undo deploy/dispatch` — safe, no data at risk,
  in-flight assignments are retried by the caller.
- Restart one replica: `kubectl delete pod <name>` — in-process driver state
  for that replica is lost, so assignments in flight on it may be repeated.
  There is no idempotency key today; duplicates are possible.
