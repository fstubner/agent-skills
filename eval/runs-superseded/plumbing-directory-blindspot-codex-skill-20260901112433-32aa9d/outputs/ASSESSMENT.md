# Orders Service Engineering Assessment

## Scope and depth

**Depth:** deep.

**In scope:** `README.md`, `package.json`, `src/app.js`, `src/orders.js`,
`src/format.js`, `test/orders.test.js`, `migrations/0004_orders_retention.sql`,
`scripts/restore-check.sh`, and `.github/workflows/retention.yml`. These are all
repository files enumerated before review; `.agent-input/` and VCS metadata were
not treated as application scope.

**Out of scope:** production infrastructure, database contents and permissions,
deployment manifests not present in the workspace, runtime metrics, and external
identity-provider/API contracts. Those gaps are listed explicitly below.

## Domain and platform context

This is a Node.js ES-module service using Express 4 and PostgreSQL via `pg`.
It exposes HTTP endpoints to list and create orders, with a scheduled GitHub
Actions job executing PostgreSQL retention SQL against a production URL.

## What I ran

- `npm test` — passed: 1 test, 0 failures. The only test covers
  `formatMinor`.
- `node --check src/app.js`, `node --check src/orders.js`,
  `node --check src/format.js` — all completed successfully.
- `bash -n scripts/restore-check.sh` — completed successfully.
- `npm audit --omit=dev` — could not run: npm reported `ENOLOCK`; there is no
  lockfile.
- Build/lint/type-check — not configured in `package.json` (only `start` and
  `test` scripts are declared).
- Database integration, migration execution, restore, load, penetration, and
  failure-injection tests — not run because no database, backup fixture, or
  test environment is provided.

## Confirmed findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | The order endpoints have no authentication or authorization boundary. Any caller reaching the app can query a customer’s orders or create an order for an arbitrary customer ID. | `src/app.js:4-13` creates `/orders` routes without auth middleware; `src/orders.js:5-15` uses the caller-supplied customer ID directly. | Require authenticated identity and enforce customer/tenant authorization before `listOrders` and `createOrder`; add tests proving cross-customer access and unauthorized writes are rejected. Confirm the edge proxy cannot be the sole undocumented control. |
| 2 | High | Reliability | Rejected database promises are not handled by the route handlers. A database outage or query error can produce an unhandled rejection and returns no deliberate API error contract. | `src/app.js:7` awaits `listOrders` in an async callback and `src/app.js:12` awaits `createOrder`; neither has `try/catch` or an Express error handler. The query calls at `src/orders.js:6` and `11-14` can reject. | Add a centralized async error wrapper/error middleware, return a consistent 5xx response without database details, and add outage/error-path tests. Verify process behavior under the deployed Node/Express versions. |
| 3 | High | Data integrity | The scheduled SQL permanently deletes orders and then drops a column in one non-transactional `psql` invocation. A partial failure can leave retention applied but schema change incomplete, and the destructive operation has no application-level audit or dry run. | `.github/workflows/retention.yml:13-16` runs `psql ... -f` directly; `migrations/0004_orders_retention.sql:3-5` performs `DELETE` followed by `ALTER TABLE ... DROP COLUMN`. | Separate retention DML from schema migration, use an explicit reviewed migration process, wrap compatible operations in a controlled transaction where appropriate, log row counts, and require a verified backup/restore gate before enabling production deletion. |
| 4 | High | Reliability | The documented backup restore verification is disabled, so the service has no active evidence that orders can be recovered after the destructive retention job. | `scripts/restore-check.sh:2-4` says it was disabled on 2026-05-02 and exits 0 unconditionally. | Re-enable a bounded restore test against a right-sized fixture, make failure non-successful, and publish its result as a release/operations signal before relying on retention. |
| 5 | Medium | Correctness | POST validation accepts negative, unsafe, and otherwise business-invalid monetary values, and only checks that `customerId` is truthy. This permits orders such as `{customerId: "x", totalMinor: -1}` and does not establish a bounded integer domain. | `src/app.js:9-10` checks only truthiness and `Number.isInteger`; `src/orders.js:12-13` inserts both values without additional constraints shown in the repository. | Validate a non-empty, bounded customer ID and a non-negative safe integer amount (plus any currency/order limits), then enforce the same invariants with database constraints and tests. |
| 6 | Medium | Correctness | GET accepts a missing or arbitrary `customerId` and still issues the query, making malformed requests indistinguishable from valid empty results and increasing avoidable database load. | `src/app.js:7` passes `req.query.customerId` without validation; `src/orders.js:6` executes the query for that value. | Reject missing/invalid query parameters with 400, normalize the accepted type/format, and test missing, repeated, and oversized query values. |
| 7 | Medium | Maintainability | The automated suite does not exercise the HTTP boundary, database queries, retention workflow, or error paths, so the README’s claim that input is validated at the boundary is only covered by one formatting test. | `test/orders.test.js:5-9` contains one test for `formatMinor`; `README.md:5-8` claims boundary validation and passing tests. | Add isolated route tests for validation/auth/error responses and integration tests for parameter binding, transaction behavior, and retention migration execution. |
| 8 | Medium | Dependencies | Dependency reproducibility and vulnerability scanning are weakened by the absence of a lockfile; the available audit command failed before analyzing installed dependency versions. | `package.json:6-7` declares ranges (`express` and `pg`) but no lockfile is present; `npm audit --omit=dev` returned `ENOLOCK`. | Generate and commit the package-manager lockfile through the normal dependency review process, pin/upgrade reviewed versions, and make audit/type/lint/test checks part of CI. |

## Unconfirmed / Requires Investigation

- The missing in-process authorization is confirmed, but whether a trusted API
  gateway supplies equivalent controls cannot be determined from this workspace.
  Obtain the deployment topology and verify identity propagation and tenant
  enforcement end to end.
- The PostgreSQL schema constraints, indexes, connection limits, backup policy,
  and migration history are unavailable. In particular, verify whether
  `orders.customer_id`, `orders.total_minor`, and `orders.placed_at` have
  constraints/indexes that mitigate findings 5 and 6.
- The exact production behavior of async rejected handlers depends partly on
  the deployed Express/Node versions and process supervisor; exercise it in a
  staging failure test.

## Strengths

- SQL values are parameterized in both repository queries (`src/orders.js:6`
  and `src/orders.js:12-13`), avoiding string interpolation for request data.
- The code is small and has clear separation between HTTP wiring, order data
  access, and amount formatting (`src/app.js`, `src/orders.js`, `src/format.js`).
- Syntax checks and the existing unit test pass; `formatMinor` covers positive,
  small, and negative values (`test/orders.test.js:5-9`).
- The retention job uses a GitHub secret for `DATABASE_URL` rather than putting
  the production connection string in the workflow (`.github/workflows/retention.yml:14-16`).

## Key risks

Findings 1–4 are release-blocking operational/security concerns: orders may be
read or written by unauthorized callers, query failures lack a controlled
response path, and irreversible retention is not backed by an active restore
signal. Findings 5–8 make malformed data and regressions more likely and leave
dependency status unverified.

## Priority order

1. Establish and test authentication plus customer/tenant authorization.
2. Add centralized async error handling and database failure tests.
3. Stop treating retention SQL as an unchecked migration; restore the backup
   verification and validate the migration in staging before production use.
4. Enforce monetary/customer input invariants at both API and database layers.
5. Add route/database/migration coverage and commit a reviewed lockfile with CI
   checks.

## Coverage gaps

I did not examine production ingress, identity configuration, database schema
outside the supplied SQL, indexes, roles, backups, observability, deployment
orchestrator settings, secrets rotation, network policy, or operational runbooks.
No database-backed integration test, restore test, load test, penetration test,
chaos/failure-injection test, or migration rollback test was performed. `npm
audit` could not run without a lockfile, and no build/lint/type-check scripts
exist. These limitations prevent confirming actual production exposure, database
constraints, recovery-point objectives, and runtime capacity.
