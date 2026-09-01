# Orders Service Engineering Assessment

## Scope and approach

**Depth:** targeted. I enumerated and read every repository file relevant to the service: `README.md`, `package.json`, `src/`, `test/`, `migrations/`, `scripts/`, and `.github/workflows/`. I also ran the declared and applicable project checks listed below.

**In scope:** HTTP handlers, order persistence, amount formatting, tests, package/tooling configuration, retention SQL, backup-restore check, and the scheduled workflow.

**Out of scope:** production infrastructure and database configuration not present in the repository, deployment topology, network/IAM configuration, live database contents, backup retention policy, runtime metrics, and external vulnerability/license databases. No production requests or destructive database commands were run.

## Context

This is a small Node.js ES-module service using Express 4 and PostgreSQL via `pg` (`package.json:2-6`). It exposes HTTP endpoints for listing and creating customer orders (`src/app.js:7-13`), targets a server runtime, and uses GitHub Actions plus `psql` for scheduled retention (`.github/workflows/retention.yml:1-16`).

## What I ran

| Command | Result |
|---|---|
| `npm test` | Passed: 1 test, 0 failures. The only test is minor-unit formatting. |
| `npm run build` | Could not run: `Missing script: "build"`. |
| `npm run lint` | Could not run: `Missing script: "lint"`. |
| `npm run typecheck` | Could not run: `Missing script: "typecheck"`. |
| `npm audit --audit-level=high` | Could not run: `ENOLOCK`; no lockfile exists. |
| `bash scripts/restore-check.sh` | Exited 0 without checking anything; the script is an explicit no-op. |

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---:|---|---|---|---|---|
| 1 | High | Reliability / Data integrity | The nightly retention workflow executes a migration containing a one-time schema change. The first successful run drops `legacy_reference`; the next scheduled run attempts the same `ALTER TABLE` and fails, so retention is no longer reliably applied. | `.github/workflows/retention.yml:13-16` runs `psql ... -f migrations/0004_orders_retention.sql` nightly. `migrations/0004_orders_retention.sql:3-4` combines the recurring `DELETE` with `ALTER TABLE orders DROP COLUMN legacy_reference` and has no migration tracking or conditional guard. | Separate schema migrations from recurring retention SQL. Track/apply schema changes once through the deployment migration process, and make the scheduled job run only an idempotent purge statement. Add a job failure alert and a test against a representative schema. |
| 2 | High | Data integrity / Operations | Backup restore verification is disabled, while the retention job permanently deletes orders. This leaves no repository-enforced evidence that backups can recover data before automated deletion occurs. | `scripts/restore-check.sh:2-4` says it was disabled and immediately executes `exit 0`; `migrations/0004_orders_retention.sql:1-3` permanently deletes rows older than 90 days. | Re-enable a bounded, representative restore check with an explicit timeout and fixture management; fail and alert on restore failure. Document how the 90-day policy aligns with backup retention and recovery objectives. |
| 3 | High | Reliability | Database errors from both endpoints become unhandled async handler rejections rather than controlled HTTP responses. A connection failure or query error can produce an unhandled rejection and leaves clients without a defined error contract. | `src/app.js:7` awaits `listOrders` directly in an async callback, and `src/app.js:12` awaits `createOrder` without `try/catch` or Express async-error middleware. `src/orders.js:6` and `src/orders.js:11-15` perform the external database calls. | Add centralized async error handling compatible with the Express version, return a stable 5xx response, and log correlation/context without leaking database details. Add tests for rejected list and create queries. |
| 4 | Critical | Security | The repository shows no authentication or authorization on endpoints that expose and create customer orders. If these routes are reachable outside a trusted private boundary, a caller can read another customer’s orders by supplying `customerId` and create orders for an arbitrary customer. | `src/app.js:7` accepts `req.query.customerId` and calls `listOrders`; `src/app.js:8-13` accepts `req.body.customerId` and calls `createOrder`. Neither route checks identity or ownership. `README.md:3` describes both endpoints without an authentication requirement. | Require an authenticated principal at the service boundary and derive the customer identity from that principal rather than caller-controlled identifiers. Enforce authorization in the service/database path and add cross-customer access tests. If a gateway supplies auth, document and verify that trust boundary plus defense-in-depth behavior here. |
| 5 | Medium | Input validation / Correctness | List requests have no boundary validation, and create validation permits values that are structurally valid but likely invalid business data. Empty/whitespace customer IDs are accepted, negative totals are accepted, and non-finite integer edge cases are not constrained by a domain range. | `src/app.js:7` passes `req.query.customerId` directly to the query. `src/app.js:9` checks only truthiness and `Number.isInteger(totalMinor)`; `src/format.js:2-4` explicitly formats negative totals, confirming the application has a negative-value path. | Define and enforce customer ID format/length and a non-negative, bounded `totalMinor` domain at the boundary and persistence layer. Return 400 for missing/invalid list identifiers and test malformed, negative, oversized, and boundary values. |
| 6 | Medium | Maintainability / Verification | Automated coverage does not exercise the service’s main behavior. The passing test covers only `formatMinor`; there are no tests for either HTTP endpoint, PostgreSQL queries, validation, errors, retention, or recovery. | `test/orders.test.js:5-9` contains one test with three formatting assertions. The endpoint and database logic are in `src/app.js:7-13` and `src/orders.js:5-15` with no corresponding tests. | Add isolated handler tests for validation, authorization, success, and database failure paths, then add integration tests against PostgreSQL (including migration and retention behavior). Make these checks part of CI before handoff. |
| 7 | Medium | Dependency / Supply chain | Dependencies cannot be audited reproducibly from the repository because there is no lockfile, and the declared ranges permit dependency drift between installs. | `package.json:6` declares caret ranges for `express` and `pg`; `npm audit --audit-level=high` failed with `ENOLOCK`. | Commit the package manager lockfile, use deterministic CI installs, and run the audit as a CI check. Review and remediate any vulnerabilities reported for the resolved versions. |

## Unconfirmed / Requires Investigation

- **Deployment exposure and effective auth:** The source has no auth checks, but an unexamined API gateway or service mesh might enforce them. Confirm route reachability, identity propagation, and customer-to-principal authorization in deployment configuration.
- **`psql` availability and database permissions:** The workflow assumes `psql` is installed and that `PRODUCTION_DATABASE_URL` permits both deletion and DDL. Validate this in the actual GitHub runner/environment without printing the secret.
- **Connection lifecycle and shutdown:** `src/orders.js:3` creates a module-global pool, but no graceful shutdown hook is visible. Confirm process termination behavior and pool/connection limits in the platform runtime.
- **Retention policy correctness:** The 90-day cutoff and timezone semantics may be intentional, but business/legal retention requirements and backup retention were not available for validation.

## Strengths

- SQL statements use positional parameters for both read and write queries (`src/orders.js:6,11-14`), reducing direct SQL injection risk in those statements.
- Input validation is at least partially placed at the HTTP boundary for order creation (`src/app.js:8-11`), and the app has a small, straightforward module structure.
- The available test passes (`npm test`: 1 passed, 0 failed), and `formatMinor` has coverage for positive, small, and negative amounts (`test/orders.test.js:5-9`).

## Key Risks

Findings 1 and 2 together make retention and recoverability operationally unsafe: the scheduled job mixes recurring deletion with a one-time DDL change, while the restore check cannot detect backup failure. Finding 4 is the highest-impact security concern if the service is not fully isolated behind a trusted authorization layer. Finding 3 means normal database faults have no defined client or process behavior.

## Priority Order

1. Establish and verify the authentication/authorization boundary (Finding 4), including cross-customer access tests.
2. Remove the schema DDL from the nightly job and make retention independently idempotent and observable (Finding 1).
3. Restore meaningful backup verification and reconcile backup retention with the deletion policy (Finding 2).
4. Add centralized database error handling and failure-path tests (Finding 3).
5. Tighten domain validation and add endpoint/database integration coverage (Findings 5-6).
6. Add and commit a lockfile, then run dependency audit in CI (Finding 7).

## Coverage Gaps

- No production or staging database was accessed; schema contents, indexes, constraints, transaction settings, and query plans were not verified.
- No deployment, gateway, IAM, secret-management, observability, or platform configuration was available beyond the checked-in workflow.
- No load, concurrency, fault-injection, penetration, backup restore, or end-to-end tests were performed.
- Build, lint, and type-check commands were unavailable because no scripts are declared; dependency audit was unavailable because no lockfile exists.
- The repository’s own restore check was attempted but is disabled and therefore provides no restore evidence.
- No external dependency vulnerability or license database was consulted.
