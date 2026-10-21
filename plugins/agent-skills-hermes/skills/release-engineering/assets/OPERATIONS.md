# Operations

<!-- Written for whoever is on call, not for whoever built this. Every
     section fails the gate when empty; a heading with nothing under it is
     the shape a template leaves behind. -->

## Signals

<!-- What this service emits that says it is healthy, and where that lands.
     Name the health endpoint, the log destination, and the field that ties
     one request together across services.

     e.g. GET /healthz returns 200 with {db, queue} sub-checks.
          Structured JSON logs to stdout -> Loki; every line carries
          request_id, propagated from the X-Request-Id header. -->

## Alerts

<!-- What pages a human, at what threshold, and what they do first. An alert
     with no first response is a notification.

     e.g. 5xx rate > 2% over 5m -> pages on-call -> check /healthz, then
          roll back per Recovery below.
          Queue depth > 10k for 15m -> ticket, not a page. -->

## Failure modes

<!-- How THIS system is known to break and the symptom you would see first.
     Generic advice belongs in a book.

     e.g. Card processor times out -> charges retry forever, queue depth
          climbs before error rate does.
          Migration lock held -> writes stall, health stays green. -->

## Recovery

<!-- Rollback and restart, as commands, and what data is at risk in each.
     Rule 4 says a rollback path must exist; this is where the person using
     it at 3am reads it.

     e.g. Roll back: `kubectl rollout undo deploy/api` — safe, no data loss.
          Restart worker: `systemctl restart worker` — in-flight jobs are
          retried, duplicates possible without an idempotency key. -->
