# Engineering assessment — orders API

## Scope

**In scope:** every file in the repository. `src/`, `test/`, `migrations/`,
`.github/workflows/`, `scripts/`, `package.json`, `README.md`.

**Out of scope:** the running service, the production database, and the
GitHub Actions environment — none is reachable from this workspace.

**Depth:** targeted. Every file listed above was opened and read in full.

I enumerated the tree before reading anything, and kept the listing beside the
findings. That matters here: the application code is the smallest and
healthiest part of this repository, and every serious finding is in a
directory that looks like plumbing.

## What I ran

```
$ npm test
✔ minor units render as a decimal amount (1.1ms)
ℹ pass 1  ℹ fail 0
```

One test, and it exercises `formatMinor` only. Nothing in the suite touches
`src/orders.js`, `src/app.js`, the migration or the workflow.

```
$ npm start
```
Not attempted. It needs `DATABASE_URL` and a reachable Postgres, neither of
which exists here.

No lint or type-check command is declared in `package.json`, so none was run.
There is no CI workflow that runs the tests either — the only workflow in
`.github/workflows/` is the retention job below.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Data integrity | Nightly job irreversibly deletes production order rows | `.github/workflows/retention.yml:16` runs `psql` against `PRODUCTION_DATABASE_URL` with `migrations/0004_orders_retention.sql:3`, an unbounded `DELETE FROM orders` | Move retention behind an archival copy and a dry-run count; require manual approval on the environment |
| 2 | Critical | Data integrity | The same nightly job drops a column, every night | `migrations/0004_orders_retention.sql:5` — `ALTER TABLE orders DROP COLUMN legacy_reference` sits in a file the schedule re-runs | Separate one-off DDL from recurring data jobs; the file is applied on a cron, so it is not a migration |
| 3 | High | Reliability | The backup restore check has been stubbed out since May and always reports success | `scripts/restore-check.sh:4` is `exit 0` under a comment dated 2026-05-02 | Either restore the check or delete it; a check that cannot fail is worse than no check beside finding 1 |
| 4 | Medium | Maintainability | The test suite covers a formatting helper and nothing else | `test/orders.test.js` imports only `src/format.js`; `src/orders.js` and `src/app.js` are untested | Add coverage for the order queries and the validation branch in `src/app.js` |
| 5 | Low | Reliability | No workflow runs the tests | `.github/workflows/` contains only `retention.yml` | Add a CI workflow running `npm test` on push |

**Findings 1 and 2 interact and that is the real risk.** A migration file is
normally applied once. This one is executed by a cron schedule, so the
`DELETE` runs nightly by design and the `DROP COLUMN` runs nightly by
accident — succeeding the first night and erroring every night after, which
means the workflow has been failing or the column keeps being re-added.
Either way nobody is reading the result, because finding 3 removed the only
thing that would have noticed data loss.

## Unconfirmed / requires investigation

- **Whether the retention job has actually been running.** The schedule is
  declared, but I cannot see run history from here. If it has never fired,
  findings 1 and 2 are latent rather than active. That distinction changes
  the urgency and nothing in this repository answers it.
- **Whether `legacy_reference` still exists.** If the first run dropped it,
  every subsequent run errors at line 5 and the `DELETE` on line 3 may never
  commit — which would be an accidental safety net. I have not seen the
  schema and am not relying on it.

## Strengths

- **The application code is careful.** `src/app.js` validates both fields at
  the boundary before anything reaches the database, including an integer
  check on `totalMinor` rather than a truthiness test.
- **Every query is parameterised.** `src/orders.js` uses `$1`/`$2` placeholders
  throughout; there is no string interpolation into SQL anywhere in the tree.

## What I did not examine

- **The production database and its backups.** Finding 1's blast radius
  depends on data volume and retention elsewhere, and I can see neither.
- **GitHub Actions run history, secrets, and environment protection rules.**
  Whether `PRODUCTION_DATABASE_URL` is gated by a required reviewer is
  invisible from the repository and would change finding 1's severity.
- **Any dependency audit.** `npm audit` was not run because dependencies are
  not installed in this workspace.
- **Application behaviour at runtime.** Nothing here was executed beyond the
  one unit test.
