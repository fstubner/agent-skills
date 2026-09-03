# Engineering Assessment: Orders Service

**Date**: 2026-09-03  
**Target**: `orders-api`  
**Status**: Handover Assessment for Platform Team  

---

## 1. Scope

- **In Scope**:
  - Service codebase (`src/app.js`, `src/orders.js`, `src/format.js`)
  - Test suite (`test/orders.test.js`)
  - Manifest and configuration (`package.json`, `README.md`)
  - Database migrations (`migrations/0004_orders_retention.sql`)
  - Maintenance workflows (`.github/workflows/retention.yml`)
  - Operational scripts (`scripts/restore-check.sh`)
- **Out of Scope**:
  - Underlying database infrastructure / PostgreSQL cluster deployment
  - Production secrets management infrastructure (GitHub Actions secret store)
  - Prior numbered database migrations (0001–0003 not present in repository)
- **Depth**: `deep`
  - All repository files read and audited in full.
  - Automated project test suite, runtime syntax verification, and dependency tooling evaluated.

---

## 2. Environment

- **Runtime**: Node.js `v24.14.1` (ES modules, `"type": "module"`)
- **Package Manager**: npm `11.11.0`
- **Framework & Libraries**:
  - Express `^4.19.0`
  - pg (node-postgres) `^8.11.0`
- **CI / Workflows**: GitHub Actions (`.github/workflows/retention.yml`)
- **Database**: PostgreSQL
- **Test Runner**: Node.js built-in test runner (`node --test`)

---

## 3. Tooling Results

### What I Ran

#### 1. `npm test`
- **Command**: `node --test test/orders.test.js`
- **Output**:
  ```text
  > test
  > node --test test/orders.test.js

  ✔ minor units render as a decimal amount (1.1179ms)
  ℹ tests 1
  ℹ suites 0
  ℹ pass 1
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 173.9313
  ```
- **Exit Code**: `0`

#### 2. `node --check` (Syntax Validation)
- **Command**: `node --check src/app.js; node --check src/orders.js; node --check src/format.js; node --check test/orders.test.js`
- **Output**: Clean exit, no syntax or parse errors.
- **Exit Code**: `0`

#### 3. `npm audit`
- **Command**: `npm audit`
- **Output**:
  ```text
  npm error code ENOLOCK
  npm error audit This command requires an existing lockfile.
  npm error audit Try creating one first with: npm i --package-lock-only
  npm error audit Original error: loadVirtual requires existing shrinkwrap file
  ```
- **Exit Code**: `1` (Missing `package-lock.json`)

#### 4. Project Linters / Type Checkers
- **Status**: Unavailable / Not configured. The repository does not declare an `eslint`, `prettier`, or TypeScript configuration in `package.json`.

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | **Critical** | Data Integrity | Nightly retention workflow executes DDL migration dropping table column on every scheduled run | `migrations/0004_orders_retention.sql:5` and `.github/workflows/retention.yml:16` — `.github/workflows/retention.yml` executes `psql "$DATABASE_URL" -f migrations/0004_orders_retention.sql` every night (`cron: '0 2 * * *'`). Line 5 contains `ALTER TABLE orders DROP COLUMN legacy_reference;`. Once dropped on the initial run, subsequent executions fail with a SQL error (`column does not exist`), failing the nightly job, or repeatedly drop schema columns. | Separate one-off DDL migrations from recurring DML maintenance purge tasks. Move `DELETE FROM orders ...` to a dedicated maintenance script and remove `ALTER TABLE` from recurring workflows. |
| 2 | **Critical** | Reliability | Backup restore verification script is hard-disabled with dummy `exit 0` | `scripts/restore-check.sh:2-4` — Script comment states: `Disabled 2026-05-02 because it was timing out in CI; re-enable once the fixture database is smaller. exit 0`. Backup restorability and disaster recovery verification are entirely unverified in CI. | Re-enable automated verification of database backup restorability with an appropriately sized fixture or isolated test environment. |
| 3 | **High** | Reliability | Missing `async` error handling in Express route handlers causes unhandled promise rejections on database errors | `src/app.js:7,12` — Route handlers `app.get('/orders', async (req, res) => ...)` and `app.post('/orders', async (req, res) => ...)` do not catch database rejections or forward to `next(err)`. In Express 4, unhandled promise rejections cause client requests to hang indefinitely or crash the process. | Wrap async handler logic in `try/catch` forwarding to `next(err)` or use an async route wrapper utility. |
| 4 | **High** | Reliability | Module-level database pool instantiation lacks lifecycle management and prevents clean shutdown | `src/orders.js:3` — `const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });` is instantiated at module evaluation time. The pool cannot be mocked or cleanly terminated (`pool.end()`), preventing graceful SIGTERM/SIGINT teardown and leaking connections across test environments. | Encapsulate pool creation in a factory or pass the database client/pool into repository functions or application context. Implement graceful shutdown handlers for process termination signals. |
| 5 | **Medium** | Correctness | Missing input validation on query parameters allows unbounded data retrieval | `src/app.js:7` — `req.query.customerId` is passed directly to `listOrders(customerId)`. If `customerId` is omitted (`undefined`), PostgreSQL executes `WHERE customer_id = NULL` returning no records, and no type or format check is enforced. No pagination (`LIMIT`/`OFFSET`) exists, allowing query memory exhaustion on large customer histories. | Validate `customerId` in `GET /orders` route handler (e.g. return 400 if missing or invalid format), and implement pagination bounds (`limit`, `cursor`/`offset`). |
| 6 | **Medium** | Correctness | Inadequate validation on `totalMinor` allows negative order amounts | `src/app.js:9` — Validation checks `Number.isInteger(req.body?.totalMinor)`, but permits negative integers (e.g., `-500`). This allows creation of negative-value orders unless intentionally designed for refunds. | Constrain `totalMinor` validation to positive integers (`req.body.totalMinor > 0`) or define explicit order type handling. |
| 7 | **Medium** | Maintainability | Missing package lockfile prevents deterministic builds and vulnerability scanning | `package.json` lacks a corresponding `package-lock.json` in the workspace root. As a result, `npm audit` fails with `ENOLOCK`, and dependency versions can drift across deployments. | Commit a valid `package-lock.json` to lock dependency trees and re-enable automated vulnerability auditing. |
| 8 | **Medium** | Maintainability | Unit test suite tests isolated formatting utility but completely omits API routes and database logic | `test/orders.test.js:1-10` — The test suite contains exactly 1 test verifying `formatMinor`. `src/app.js` and `src/orders.js` have 0% test coverage; endpoint behavior, validation rules, and database interactions are unexercised. | Introduce integration tests with a test database or mocked pg pool verifying `createApp()` routes, HTTP status codes, error paths, and validation logic. |
| 9 | **Low** | Maintainability | Unused internal module | `src/format.js:1-6` — `formatMinor` is implemented and tested, but never imported or used by `src/app.js` or `src/orders.js`. API consumers receive raw `total_minor` integer values. | Either use `formatMinor` within response serialization or clarify in API contract that currency formatting is client-side only. |

---

## 5. Unconfirmed Issues

- **Database Connection Pooling Limits Under Horizontal Scale**:
  - *Observation*: `pg.Pool` is initialized without explicit `max`, `idleTimeoutMillis`, or `connectionTimeoutMillis` configurations in `src/orders.js:3`.
  - *Investigation Required*: Verify production concurrency targets and PostgreSQL server connection limits to ensure default pool settings (10 connections per instance) do not exhaust server capacity under horizontal container scaling.

---

## 6. Summary

### Strengths
- **Parameterized SQL Queries**: Both `SELECT` and `INSERT` queries in `src/orders.js:6,11-14` strictly utilize PostgreSQL parameter placeholders (`$1`, `$2`), effectively preventing SQL injection vulnerabilities.
- **Strict Integer Validation for Monetary Amounts**: Monetary values are stored and validated as integer minor units (`total_minor` / `totalMinor`), avoiding floating-point precision issues common with decimal representations.

### Key Risks
- **Destructive DDL in Scheduled Purge Job (Finding #1)**: `.github/workflows/retention.yml` executes migration `0004_orders_retention.sql` on a nightly cron, running `ALTER TABLE orders DROP COLUMN legacy_reference;` repeatedly. This couples destructive DDL with data cleanup, guaranteeing failures on subsequent runs.
- **Disabled Disaster Recovery Validation (Finding #2)**: `scripts/restore-check.sh` was suppressed with an early `exit 0`, leaving backup restorability unverified.
- **Crash / Timeout Risk on Database Errors (Finding #3)**: Express 4 async route handlers lack error catching, leading to unhandled rejections if the database drops a connection or rejects a query.

### Priority Order
1. **Fix Nightly Retention Workflow (Finding #1)**: Decouple DDL migration `ALTER TABLE` from the nightly retention purge.
2. **Re-enable and Fix Backup Restore Check (Finding #2)**: Implement functioning restore tests with a lightweight fixture to guarantee disaster recovery capability.
3. **Add Express Async Error Handling (Finding #3)**: Protect route handlers in `src/app.js` with error propagation to prevent hung connections.
4. **Commit `package-lock.json` (Finding #7)**: Enable deterministic builds and `npm audit` dependency security scanning.
5. **Add Input Validation & Route Integration Tests (Findings #5, #6, #8)**: Enforce boundary validation on `GET /orders` customer query parameter and positive amounts on `POST /orders`, and back with integration tests.
6. **Decouple Database Pool Lifecycle (Finding #4)**: Allow controlled connection cleanup and testing support.

### Coverage Gaps
- **Prior Migrations**: Migrations `0001` through `0003` were not present in the workspace and could not be evaluated for table constraints, foreign keys, or indexes.
- **Production Infrastructure & Secrets**: Actual database configurations, credentials, and network topologies could not be evaluated directly.
- **End-to-End Database Integration**: Automated database integration tests could not be run locally as no live PostgreSQL service container or instance was configured in the test harness.
