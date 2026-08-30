# Ledger API

Double-entry ledger read API. Deployed from `main` by
`.github/workflows/deploy.yml`.

The pipeline runs every check we have. It was assembled by adding each new
check to the end of the chain as we wrote it, which is why the order is what
it is.

Yesterday a missing semicolon failed `lint` 24 minutes into the run, after the
staging deploy and the full integration suite had already gone green.
