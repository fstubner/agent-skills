# Ledger API

Invoice fee API. One image is built per commit and promoted by digest from
staging to production — the pipeline in `.github/workflows/deploy.yml` does
not rebuild, and `docker inspect` confirms staging and production run the same
digest.

The environment is passed in at deploy time as `ENVIRONMENT`.

Staging has never disagreed with production on a fee. The staging accounts do
not have hardware keys, and nothing in staging mails a real customer.
