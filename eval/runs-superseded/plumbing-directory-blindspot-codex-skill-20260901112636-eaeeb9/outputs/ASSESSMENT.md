# Orders Service Engineering Assessment

Date: 2026-09-01

## Scope and context

Depth: **targeted**. I enumerated and read the complete service surface: `src/`, `test/`, `migrations/`, `scripts/`, `package.json`, `README.md`, and `.github/workflows/retention.yml`.

This is a small Node.js/ESM Express HTTP service using PostgreSQL via `pg`. It targets a server/cloud runtime and exposes order listing and creation endpoints.

## What I ran

- `npm test` — passed: 1 test, 1 pass, 0 failures.
- `npm run build` — failed to start: `npm error Missing script: "build"`.
- `npm run lint` — failed to start: `npm error Missing script: "lint"`.
- `npx tsc --noEmit` — failed: TypeScript is not installed; `npx` fetched deprecated `tsc@2.0.4`, which reported “This is not the tsc command you are looking for”.
- `npm audit --omit=dev` — failed: `ENOLOCK`; no lockfile exists.
- `node --check src/app.js`, `node --check src/orders.js`, `node --check src/format.js`, `bash -n scripts/restore-check.sh` — all passed with no output.
- Applicable `check-smells`, `check-organization`, `check-migrations`, `check-backend`, and `check-frontend` commands — unavailable; none was installed or discoverable.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Reliability / Data integrity | The scheduled retention job repeatedly executes a migration that contains a one-time `ALTER TABLE ... DROP COLUMN`. After the first successful run, subsequent nightly runs fail at the schema statement; because `psql` is invoked without an explicit transaction, the preceding delete can still commit independently. | `.github/workflows/retention.yml:3-16` runs `psql "$DATABASE_URL" -f migrations/0004_orders_retention.sql` nightly. `migrations/0004_orders_retention.sql:3-5` performs both the retention delete and `DROP COLUMN legacy_reference`. | Separate recurring retention SQL from versioned schema migrations. Make the scheduled command idempotent and verify its exit status; apply the column drop once through a migration runner, with an explicit transaction where appropriate. Test a second consecutive workflow execution. |
| 2 | High | Data integrity / Operations | The backup restore check is disabled while the service is being handed off, leaving recovery capability unverified. | `scripts/restore-check.sh:2-4` says the check was disabled due to CI timeouts and exits successfully via `exit 0`. | Re-enable a bounded restore test using a smaller representative fixture or a scheduled operational environment, and fail/report clearly when restore validation is not performed. |
| 3 | Medium | Correctness / API validation | `GET /orders` does not validate `customerId` at the HTTP boundary, contrary to the service documentation. Missing or malformed input reaches the database call and can produce a 500 or inconsistent API behavior instead of a deterministic 400. | `README.md:5-6` claims input is validated at the boundary. `src/app.js:7` passes `req.query.customerId` directly to `listOrders`; only POST input is checked at `src/app.js:8-11`. | Validate that GET has exactly one non-empty, correctly shaped `customerId`; return 400 before calling PostgreSQL, and add endpoint tests for missing, repeated, and malformed values. |
| 4 | Medium | Maintainability / Verification | The automated suite does not exercise either HTTP endpoint, PostgreSQL integration, migration behavior, or operational scripts. A green test result therefore provides little evidence for the production-critical paths. | `test/orders.test.js:5-9` contains one test covering only `formatMinor`; `npm test` reported `1..1`, `# pass 1`. | Add request-level tests for both success and validation/error paths, database-backed or mocked query tests for `listOrders`/`createOrder`, and a migration/retention test that runs twice. Keep the restore check executable in CI or scheduled checks. |
| 5 | Medium | Dependencies / Supply chain | Dependencies are specified with ranges but no lockfile is committed, so installs are not reproducible and dependency vulnerability scanning cannot run. | `package.json:6` uses `^4.19.0` and `^8.11.0`; `npm audit --omit=dev` failed with `ENOLOCK` because no lockfile exists. | Generate and commit `package-lock.json`, use it in CI with `npm ci`, and run audit/dependency updates from the locked dependency graph. |
| 6 | Medium | Reliability / Error handling | Rejected database promises are not translated into controlled API responses. A query failure from either endpoint propagates through an async Express handler without an error middleware, risking an unhandled request failure and an inconsistent response/process behavior. | `src/app.js:7-12` awaits `listOrders`/`createOrder` directly; `src/app.js:14` returns the app without registering error middleware. Database calls are awaited in `src/orders.js:6` and `src/orders.js:11-15`. | Add centralized async error handling and safe client responses, log correlation/context without leaking database details, and define timeouts/health behavior for database unavailability. |

## Unconfirmed / Requires Investigation

- Authentication and authorization could not be assessed as a confirmed vulnerability from this repository alone. No auth middleware is visible in `src/app.js:4-14`, but the deployment gateway may enforce it. Confirm the platform ingress contract before exposure.
- Database schema constraints, indexes, ownership, connection pool sizing, and production data volume were not present in the inspected files. Validate that `orders.customer_id` is indexed and constrained, and that the pool is sized for the platform workload.
- The impact of `DROP COLUMN legacy_reference` on other consumers is unknown; inspect downstream queries, analytics, and rollback/backup policy before applying it.

## Strengths

- PostgreSQL queries use positional parameters rather than string interpolation (`src/orders.js:6`, `src/orders.js:12-13`), reducing injection risk for the shown query paths.
- The POST boundary rejects missing customer IDs and non-integer totals (`src/app.js:8-11`), and the source passes syntax checks.
- The repository is small and has a clear separation between HTTP wiring (`src/app.js`), persistence (`src/orders.js`), and formatting (`src/format.js`).

## Key risks

The highest operational risk is the retention workflow/migration coupling (Finding 1), compounded by the disabled restore verification (Finding 2). The handoff should also address untested endpoint/database behavior (Finding 4) before relying on the passing formatter test.

## Priority order

1. Split the recurring retention delete from the one-time schema change and test repeated execution (Finding 1).
2. Restore an actually running restore verification path (Finding 2).
3. Add centralized database error handling and GET validation (Findings 3 and 6).
4. Add endpoint, persistence, migration, and operational tests (Finding 4).
5. Commit a lockfile and make CI use reproducible installs (Finding 5).

## Coverage gaps

- No application code was changed; no production or external systems were accessed.
- No database instance, schema definition beyond the inspected SQL, production configuration, secrets, deployment manifests, ingress policy, logs, metrics, backups, or downstream consumers were available.
- No load, soak, failover, penetration, authentication, authorization, or live migration testing was performed.
- Build and lint were not available as package scripts; TypeScript is not applicable to the JavaScript source but the requested generic type-check attempt could not run; dependency audit could not run without a lockfile.
- The listed repository files and workflow were inspected; evaluation cases, graders, expected answers, and sibling run outputs were not searched for or inspected.
