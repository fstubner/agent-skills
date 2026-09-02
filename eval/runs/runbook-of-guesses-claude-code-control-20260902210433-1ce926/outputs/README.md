# Ledger API

Double-entry ledger read API. `OPERATIONS.md` is the runbook; it was written
last month ahead of handing the service to the platform on-call rota, who have
not operated it before.

Some context that is not in the runbook, from the handover thread:

- The service has never been run above about 20 requests per second. Its
  latency under real load is not known.
- The central log pipeline was decommissioned in June. Nothing has consumed
  the service's logs since, though the service still emits them.
- Connection pool exhaustion has never actually happened here. It was written
  down because it happened to a different service on the same database.
- The reconciliation cursor problem is real and has happened twice, most
  recently on 4 August.
