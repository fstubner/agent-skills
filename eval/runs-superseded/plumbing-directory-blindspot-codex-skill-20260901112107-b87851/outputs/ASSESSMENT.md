# Orders Service Engineering Assessment

## Scope and depth

**Depth:** targeted. Every repository file in the service scope was read in full.

**In scope:** `README.md`, `package.json`, `src/`, `test/`, `migrations/`,
`scripts/`, and `.github/workflows/`. Reviewed API behavior, persistence,
validation, error handling, retention/backup operations, dependencies, and
automated checks.

**Out of scope:** production infrastructure outside this repository, database
contents and indexes, deployment/ ingress configuration, identity provider or
upstream authentication, production telemetry, and the actual backup system.

## Domain and platform context

This is a Node.js ES-module/Express HTTP orders API backed by PostgreSQL via
`pg`. It targets a server/runtime environment and uses npm plus GitHub Actions
for scheduled database operations. The repository contains two API endpoints:
list orders and create an order (`README.md:3`).

## What I ran

| Command | Result |
|---|---|
| `npm test` | Passed: 1 test, 1 pass, 0 failures. The test covers `formatMinor` only. |
| `npm run build` | Could not start: `npm error Missing script: "build"`. |
| `npm run lint` | Could not start: `npm error Missing script: "lint"`. |
| `npm audit --omit=dev` | Could not run: `npm error code ENOLOCK`; no lockfile exists. |
| `node --check src/app.js` | Passed; no output. |
| `node --check src/orders.js` | Passed; no output. |
| `node --check src/format.js` | Passed; no output. |
| `bash -n scripts/restore-check.sh` | Passed; no output. |

## Confirmed findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Reliability / Operations | The nightly retention workflow reruns a migration containing a one-time schema change. The first successful run drops the column; subsequent runs fail at the `ALTER TABLE`, so retention execution becomes unreliable and the workflow reports failure. | `.github/workflows/retention.yml:13-16` runs `psql ... -f migrations/0004_orders_retention.sql` on every schedule; `migrations/0004_orders_retention.sql:4` executes `ALTER TABLE orders DROP COLUMN legacy_reference` without `IF EXISTS`. | Separate schema migration from recurring retention SQL. Apply migrations once through a migration runner, and make the recurring purge script contain only an idempotent, observable `DELETE`; add a workflow test or dry-run against a representative schema. |
| 2 | High | Reliability | Rejected database promises from both endpoints are not handled by the Express application. A database outage or query error can leave the request without a deliberate error response and produce an unhandled rejection under Express 4. | `src/app.js:7` awaits `listOrders` directly in an async arrow; `src/app.js:8-12` awaits `createOrder` without `try/catch` or an async-error wrapper. `package.json:6` pins Express 4.x (`^4.19.0`). | Add an application-wide async error wrapper (or explicit `try/catch`) and a final error middleware that returns a safe 5xx response, logs a correlation ID, and does not expose database details. Add endpoint tests for rejected queries. |
| 3 | High | Data integrity / Operations | The only restore verification is disabled, so the service has no active repository-level evidence that backups can be restored. This increases the chance that retention or an incident causes unrecoverable data loss. | `scripts/restore-check.sh:2-4` states it was disabled and immediately exits 0. | Re-enable the check with a bounded, smaller fixture or a separately provisioned restore test; make failure non-zero and publish its result/alert to the platform team. |
| 4 | Medium | Correctness / Validation | Boundary validation is incomplete: `POST /orders` accepts an empty string customer ID and any integer total, including negative values; `GET /orders` passes an absent or arbitrary `customerId` directly to the repository. | `src/app.js:7` passes `req.query.customerId` directly; `src/app.js:9` checks only truthiness and integer-ness, so `''` is rejected but whitespace/other malformed strings are accepted and negative integers pass. | Define and enforce the order/customer constraints (non-empty normalized identifier, permitted currency range, non-negative amount) for both routes, returning consistent 4xx responses. Add tests for missing, malformed, negative, and boundary values. |
| 5 | Medium | Maintainability / Supply chain | Dependencies are not reproducibly resolved or auditable in this repository. There is no lockfile, and the audit command cannot run. | `package.json:6` specifies version ranges (`^4.19.0`, `^8.11.0`); `npm audit --omit=dev` returned `ENOLOCK`. | Commit a lockfile generated from the intended Node/npm versions, use it in CI/deployments, and run dependency audit as a required check. |
| 6 | Medium | Test coverage | The passing test suite does not exercise the orders API, PostgreSQL calls, validation, error paths, retention workflow, or restore check. A green test result therefore provides little confidence in the service handoff. | `package.json:5` runs only `node --test test/orders.test.js`; `test/orders.test.js:5-9` contains one test for `formatMinor` and imports no API or database module. | Add isolated API tests for both endpoints, mocked query success/failure tests for `src/orders.js`, and migration/workflow checks covering repeat execution and restore verification. |

## Unconfirmed / Requires Investigation

- **Authentication and authorization:** no authentication appears in `src/app.js:4-13`, but an ingress/API gateway may provide it. Confirm the deployed trust boundary and require authorization for customer order access before exposing this service directly.
- **Database connection lifecycle and pool sizing:** `src/orders.js:3` creates a module-global pool from `DATABASE_URL`, but deployment limits, shutdown hooks, timeouts, and pool settings are unavailable. Validate those against platform defaults and database capacity.
- **Retention policy safety:** `migrations/0004_orders_retention.sql:3` deletes orders older than 90 days. Whether this is legally and product-wise correct, and whether customer/reporting requirements need archival, requires policy confirmation and production backup evidence.

## Strengths

- SQL values are parameterized in both repository queries (`src/orders.js:6,
  11-14`), avoiding string interpolation for request data.
- The code is small and syntactically valid: all three source files passed
  `node --check`, and the declared test command passed (`1` test, `0` failures).
- Retention is separated from request handling and scheduled outside the API
  process (`README.md:8`, `.github/workflows/retention.yml:1-16`), which keeps
  the service path simple.

## Key risks

Findings 1 and 3 are the most consequential operational risks: recurring
retention is currently coupled to a one-time destructive schema operation, while
restore verification is disabled. Finding 2 can make database failures appear
as broken or hanging API requests. Findings 4-6 weaken input correctness and
the evidence available to safely operate the service.

## Priority order

1. Split the migration from the nightly purge and prove repeat-safe execution.
2. Restore an automated backup/restore verification path with alerting.
3. Add async error handling, safe 5xx responses, and database timeout/shutdown
   behavior after validating platform connection settings.
4. Tighten and test request validation, including customer authorization at the
   confirmed deployment boundary.
5. Add a lockfile and CI quality gates; expand API, persistence, and operational
   tests.

## Coverage gaps

- No production deployment, ingress, authentication, database schema/index
  definition, backup storage, logs, metrics, or alert configuration was
  available in the repository.
- No integration test against PostgreSQL, load test, failure-injection test,
  penetration test, migration execution, or actual backup restore was run.
- Build and lint were not attempted successfully because no corresponding npm
  scripts exist. Dependency audit could not run because no lockfile exists.
- The installed dependency versions and their transitive dependency tree were
  not independently verified; `package.json` contains ranges only.
- Evaluation cases, graders, expected answers, and sibling run outputs were not
  inspected.
