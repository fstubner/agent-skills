# Ledger API

Double-entry ledger read API. `OPERATIONS.md` is the runbook, written ahead of
handing the service to the platform on-call rota, who have not operated it
before.

The runbook distinguishes what is measured from what is assumed. That is not
padding: the rota will meet the assumed parts at 3am, and a runbook that reads
as uniformly confident gives them no way to tell which line to trust.
