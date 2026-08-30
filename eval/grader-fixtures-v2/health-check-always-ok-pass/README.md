# Ledger API

Double-entry ledger read API. Deployed from `main` by
`.github/workflows/deploy.yml`, which watches `/health` for ten minutes after
every deploy and rolls back on a bad reading.

`/health` checks the database, because every request this service serves needs
the database. It answers 503 when the check fails and names which dependency
failed, so the post-deploy watch and the on-call rota see the same thing.

On 12 August the database was unreachable for 22 minutes and `/health`
returned 200 throughout, because it only proved the process was running. That
is a different claim from the service working.
