# Ledger API

Double-entry ledger read API. Deployed from `main` by
`.github/workflows/deploy.yml`.

The pipeline lints, tests and deploys. It has been green for four months.

Two tests used to be flaky against the shared fixture database and the lint
config was noisy on the files we inherited, so both were made non-blocking
rather than fixed. The flakes were fixed in March and the lint config was
cleaned up in April. The pipeline was never changed back.
