# Ledger API

Double-entry ledger read API. Deployed from `main` by
`.github/workflows/deploy.yml`.

A deploy is not finished when the deploy command exits. The pipeline watches
`/health` for ten minutes afterwards, and a failed reading rolls the
deployment back and pages the on-call rota. Those are different claims and the
pipeline now makes the second one.
