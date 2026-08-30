# Ledger API

Double-entry ledger read API. Deployed from `main` by
`.github/workflows/deploy.yml`.

Lint and the test suite both block the deploy. Neither is advisory: a failing
lint run or a failing test stops the pipeline before anything reaches
production.

The two workarounds that made them advisory — a trailing `|| true` on lint and
`continue-on-error` on the test job — outlived the problems they were added
for by several months, during which the pipeline was green regardless of what
either check found.
