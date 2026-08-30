# Ledger API

Double-entry ledger read API. Deployed from `main` by
`.github/workflows/deploy.yml`, which watches `/health` for ten minutes after
every deploy and rolls back on a bad reading.

On 12 August the database was unreachable for 22 minutes. Every request to
`/entries/:id` failed. `/health` returned 200 for the whole 22 minutes, the
post-deploy watch stayed green, and the rollback never fired.
