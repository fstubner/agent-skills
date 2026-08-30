# Ledger API

Double-entry ledger read API. Deployed from `main` by
`.github/workflows/deploy.yml`.

Stages run cheapest-first: lint, then unit tests, then the integration suite,
then staging, then production. A missing semicolon now fails in seconds rather
than 24 minutes in, and nothing is deployed anywhere until every check that
can run without a deployment has passed.
