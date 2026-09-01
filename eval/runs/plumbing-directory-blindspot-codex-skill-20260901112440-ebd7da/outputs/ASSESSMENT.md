# Orders Service Engineering Assessment

## Scope and context

Depth: **deep**.

In scope: `src/`, `test/`, `migrations/`, `scripts/`, `.github/workflows/`, `package.json`, and `README.md`. I read every file in those areas, including the retention workflow and migration. The service is a small Node.js/Express HTTP API using PostgreSQL via `pg`; its platform target is a server process, with a scheduled GitHub Actions job for retention.

Out of scope: production infrastructure, database schema/history beyond the single supplied migration, deployment manifests, secrets/IAM configuration, runtime metrics, and external systems. They are not present in the workspace.

## What I ran

- `npm test` — passed: 1 test, 1 pass, 0 failures.
- `npm run build` — could not run: package has no `build` script.
- `npm run lint` — could not run: package has no `lint` script.
- `npm run typecheck` — could not run: package has no `typecheck` script.
- `npm audit --omit=dev` — could not run: no lockfile exists (`ENOLOCK`).
- `npm ls --depth=0` — failed dependency check: `express` and `pg` are unmet/missing.
- `node --check src/app.js`, `node --check src/orders.js`, `node --check src/format.js` — all passed.
- `bash -n scripts/restore-check.sh` — passed.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Data integrity / Operations | The retention job can permanently delete orders even if the same migration later fails, and it couples routine retention to an unrelated schema drop. | `.github/workflows/retention.yml:13-16` runs `psql "$DATABASE_URL" -f migrations/0004_orders_retention.sql` against the production secret. `migrations/0004_orders_retention.sql:3` deletes all orders older than 90 days, then line 5 drops `legacy_reference`. No explicit transaction or `ON_ERROR_STOP` is configured. | Split retention into a narrowly scoped, reviewed job and schema migration. Make the migration transactional where supported, enable `ON_ERROR_STOP=1`, perform preflight checks, and require backup/restore verification before production execution. Add a dry-run/count and an auditable deletion policy. |
| 2 | High | Reliability | Database failures from both endpoints are not converted into controlled HTTP responses; rejected async handlers can escape Express 4’s promise handling. | `src/app.js:7` and `src/app.js:8-12` call async database functions without `try/catch` or async error middleware. `src/orders.js:6` and `src/orders.js:11` await `pool.query` with no handling. | Add centralized async error handling that returns a stable 5xx response and logs a request correlation ID. Add integration tests for connection failure, query failure, and response behavior; confirm process-level rejection/crash policy. |
| 3 | Medium | Correctness / Validation | Order input validation permits negative and unbounded integer totals, and the list endpoint accepts a missing/empty customer identifier. | `src/app.js:9` checks only truthiness of `customerId` and `Number.isInteger(totalMinor)`; it does not reject negative values, unsafe integers, or excessive values. `src/app.js:7` passes `req.query.customerId` directly to `listOrders`. | Define domain constraints (for example, non-empty bounded customer ID and non-negative `Number.isSafeInteger` total), enforce them at the API and database layers, and test boundary/oversize cases. Return 400 for invalid GET queries. |
| 4 | Medium | Testing / Maintainability | The only automated test covers a formatting helper; HTTP validation, database behavior, retention, and failure paths are untested. | `test/orders.test.js:5-9` contains one test with three formatter assertions and imports no app, database, migration, or workflow behavior. `package.json:5` declares only the test script. | Add isolated tests for request validation and unit tests around order operations with a mocked pool, plus disposable-PostgreSQL integration tests for queries and migrations. Add CI build/lint/type checks and migration/restore checks. |
| 5 | Medium | Operations / Recovery | The advertised restore verification is disabled and currently always succeeds, so backup recoverability is not being checked. | `scripts/restore-check.sh:2-4` says it is disabled due to CI timeouts and immediately executes `exit 0`. | Re-enable a bounded restore test using a small representative fixture, fail on restore/schema errors, publish duration/results, and document the recovery point/objectives it validates. |
| 6 | Medium | Dependency management | Dependency versions cannot be reproducibly or safely audited because there is no lockfile, and the installed dependency state is incomplete. | `package.json:6` specifies ranges (`^4.19.0`, `^8.11.0`) but no lockfile is present; `npm audit --omit=dev` returned `ENOLOCK`, and `npm ls --depth=0` reported both dependencies unmet. | Commit the package-manager lockfile, install from it in CI/deployment, run the audit in CI, and pin/upgrade dependencies according to the resulting vulnerability report. |

## Unconfirmed / Requires Investigation

- Authentication and authorization are not visible in the service. Both routes are registered without auth middleware (`src/app.js:7-12`), but a platform gateway may enforce identity outside this repository. Confirm the production ingress path and verify that a caller cannot read or create another customer’s orders.
- Database constraints, indexes, connection limits, and pooling behavior could not be assessed because no schema or production database configuration is included. In particular, confirm an index on `(customer_id, placed_at)` for the list query and constraints on `total_minor`/`customer_id`.
- The actual restore workflow, backup schedule, retention/legal requirements, and production observability were unavailable.

## Strengths

- SQL parameters are used consistently in both database queries (`src/orders.js:6`, `src/orders.js:12-13`), avoiding string interpolation for request values.
- The source files pass JavaScript syntax checks, and the existing formatter test passes all three positive/negative/zero-padding examples (`test/orders.test.js:5-9`).
- The retention action is isolated in a separately triggered scheduled workflow (`.github/workflows/retention.yml:1-6`), making its operational ownership explicit even though its safety controls need improvement.

## Key Risks

The largest release risks are the production deletion/migration behavior (Finding 1), uncontrolled database-error behavior (Finding 2), and the lack of an effective restore test (Finding 5). Missing authentication must be resolved or explicitly demonstrated at the platform boundary before exposing these routes; it remains unconfirmed here.

## Priority Order

1. Separate and transactionally protect retention/schema changes; add deletion preflight and restore evidence (Finding 1).
2. Confirm the production auth boundary and customer isolation.
3. Add centralized database error handling and integration tests (Finding 2).
4. Re-enable restore verification and establish CI checks (Findings 4-5).
5. Enforce domain validation and database constraints (Finding 3).
6. Commit a lockfile and run dependency auditing in CI (Finding 6).

## Coverage Gaps

I did not inspect production infrastructure, ingress/auth configuration, database schema or indexes, backup artifacts, deployment configuration, runtime metrics/logs, load behavior, penetration resistance, or external compliance requirements. No end-to-end HTTP/database test was run because the workspace has no database configuration and `express`/`pg` are not installed. No build, lint, or type-check command exists in `package.json`; dependency audit could not run without a lockfile. Git history and CI status were not available because this directory is not a Git repository. The supplied restore script was syntax-checked but not executed against a database because it is an unconditional no-op.

