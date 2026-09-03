# Engineering Assessment: Orders Service

**Date**: 2026-09-03  
**Target**: Orders API Service (`orders-api`)  
**Audience**: Platform Team & Engineering Leadership  
**Assessment Depth**: Deep (full source enumeration, complete manual review, project command execution, and automated structural/security checkers)

---

## 1. Scope

### In-Scope
All files and directories within the repository:
- Configuration & Manifests: `package.json`, `README.md`
- Application Code: `src/app.js`, `src/orders.js`, `src/format.js`
- Database Migrations & Retention: `migrations/0004_orders_retention.sql`
- Operational & Maintenance Scripts: `scripts/restore-check.sh`
- CI/CD Workflows: `.github/workflows/retention.yml`
- Test Suites: `test/orders.test.js`

### Out-of-Scope
- Historic migrations 0001–0003 (absent from the repository).
- Production infrastructure deployment definitions (Kubernetes manifests, Terraform, ECS task definitions), as they are maintained outside this service repository.

### Depth Level
- **Deep**: Every file in the repository was enumerated and read in full. All declared project commands (`npm test`) and applicable automated inspection checkers were executed, with stdout/stderr recorded.

---

## 2. Environment

- **Runtime**: Node.js (ES Modules, `"type": "module"`)
- **Web Framework**: Express `^4.19.0`
- **Database Driver**: `pg` `^8.11.0` (PostgreSQL)
- **Domain**: Microservice handling customer order creation and order history listing
- **Tooling & Test Runner**: `npm`, Node.js built-in test runner (`node --test`)
- **Automation / Scheduled Jobs**: GitHub Actions (`.github/workflows/retention.yml`)

---

## 3. Tooling Results (What I Ran)

### 3.1 Project Declared Commands

#### `npm test`
```text
$ npm test
> test
> node --test test/orders.test.js

✔ minor units render as a decimal amount (1.3044ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 151.2103
```
*Status: PASSED (1 test passed; exercises only isolated utility `formatMinor`)*

#### `npm audit`
```text
$ npm audit
npm error code ENOLOCK
npm error audit This command requires an existing lockfile.
npm error audit Try creating one first with: npm i --package-lock-only
npm error audit Original error: loadVirtual requires existing shrinkwrap file
```
*Status: FAILED (Exit code 1; no `package-lock.json` present)*

---

### 3.2 Automated Suite Checkers

#### `check-migrations` (SQL Migration & Data Safety)
*Command*: `node <checkers>/check-migrations.js`
```json
{
  "schemaVersion": 1,
  "skill": "data-modeling",
  "generatedAt": "2026-09-03T09:43:00.053Z",
  "root": "C:\\tmp\\agent-skills-eval-9zeC8F\\workspace",
  "verdict": "BLOCK",
  "checks": [
    {
      "id": "DM-sql-destructive-drop",
      "status": "fail",
      "detail": "DROP TABLE/COLUMN in: migrations/0004_orders_retention.sql"
    },
    {
      "id": "DM-sql-unsafe-not-null",
      "status": "pass",
      "detail": "no unsafe NOT NULL addition found"
    },
    {
      "id": "DM-sql-rename",
      "status": "pass",
      "detail": "no RENAME COLUMN/TABLE in scanned migrations"
    },
    {
      "id": "DM-sql-volatile-default",
      "status": "pass",
      "detail": "no volatile-function column default added"
    }
  ]
}
```
*Verdict: BLOCK*

#### `check-operability` (Platform & Operational Readiness)
*Command*: `node <checkers>/check-operability.js`
```json
{
  "schemaVersion": 1,
  "skill": "release-engineering",
  "generatedAt": "2026-09-03T09:43:21.219Z",
  "root": "C:\\tmp\\agent-skills-eval-9zeC8F\\workspace",
  "verdict": "BLOCK",
  "checks": [
    {
      "id": "O-operations-doc",
      "status": "fail",
      "detail": "no OPERATIONS.md — a running service with no written signals, alerts, failure modes or recovery is operable only by whoever built it"
    },
    {
      "id": "O-section-signals",
      "status": "not_evaluated",
      "detail": "no OPERATIONS.md to inspect"
    },
    {
      "id": "O-section-alerts",
      "status": "not_evaluated",
      "detail": "no OPERATIONS.md to inspect"
    },
    {
      "id": "O-section-failure-modes",
      "status": "not_evaluated",
      "detail": "no OPERATIONS.md to inspect"
    },
    {
      "id": "O-section-recovery",
      "status": "not_evaluated",
      "detail": "no OPERATIONS.md to inspect"
    },
    {
      "id": "O-health-endpoint",
      "status": "fail",
      "detail": "no health or readiness endpoint found; a deploy gate cannot observe health it cannot ask for"
    },
    {
      "id": "O-structured-logs",
      "status": "not_evaluated",
      "detail": "no logging calls recognised; whether this service emits anything could not be determined from source"
    }
  ]
}
```
*Verdict: BLOCK*

#### `check-backend` (Architecture & Secret Exposure)
*Command*: `node <checkers>/check-backend.js`
```json
{
  "schemaVersion": 1,
  "skill": "backend-engineering",
  "generatedAt": "2026-09-03T09:43:10.621Z",
  "root": "C:\\tmp\\agent-skills-eval-9zeC8F\\workspace",
  "verdict": "SHIP",
  "checks": [
    {
      "id": "B-arch-doc",
      "status": "pass",
      "detail": "single-part server; architecture doc not required"
    },
    {
      "id": "B-dual-orm",
      "status": "pass",
      "detail": "no orm detected"
    },
    {
      "id": "B-client-secrets",
      "status": "pass",
      "detail": "no secrets in client-reachable paths (gitleaks)"
    },
    {
      "id": "B-session-cookie",
      "status": "pass",
      "detail": "no session cookie set without HttpOnly/Secure/SameSite (4 source file(s) scanned)"
    }
  ]
}
```
*Verdict: SHIP*

#### `check-organization` & `check-smells`
*Commands*: `node <checkers>/check-organization.js`, `node <checkers>/check-smells.js`
- `check-organization`: `SHIP` (0 circular imports across 4 source files).
- `check-smells`: `SHIP` (no files > 400 lines, nesting depth <= 5).

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | **Critical** | Data Integrity / Reliability | Destructive DDL (`DROP COLUMN`) executed inside nightly scheduled retention workflow; causes permanent data loss and subsequent nightly run failures. | `migrations/0004_orders_retention.sql:5` (`ALTER TABLE orders DROP COLUMN legacy_reference;`) invoked by `.github/workflows/retention.yml:16`. | Remove `ALTER TABLE ... DROP COLUMN` from the nightly retention script immediately. Keep DDL migrations separate from recurring data retention maintenance scripts. |
| 2 | **Critical** | Disaster Recovery / Operations | Backup restore verification is completely bypassed and hardcoded to success (`exit 0`). | `scripts/restore-check.sh:4` (`exit 0` with comment indicating check was disabled due to CI timeouts). | Re-enable the restore check against an appropriately sized test database fixture and make it a gating CI job. |
| 3 | **High** | Reliability | Unhandled promise rejections in Express 4 route handlers will hang client requests or crash the Node process on DB errors. | `src/app.js:7` (`app.get('/orders', async (req, res) => res.json({ orders: await listOrders(...) }))`) and `src/app.js:12`. | Wrap route handlers in a `try/catch` passing errors to `next(err)`, or use an async route wrapper (e.g. `express-async-errors`). |
| 4 | **High** | Reliability | Missing error handler on PostgreSQL client pool causes unhandled process termination on idle client disconnects. | `src/orders.js:3` (`const pool = new pg.Pool(...)` without `pool.on('error', ...)`). | Attach an error listener `pool.on('error', (err) => logger.error(...))` to prevent process death on network drops or backend database restarts. |
| 5 | **High** | Correctness / Validation | `GET /orders` performs zero input validation on `customerId`; omitting query parameter causes database query failure. | `src/app.js:7` forwards `req.query.customerId` directly to `listOrders`. If undefined or non-string, `pg` parameter binding fails. | Validate `req.query.customerId` at the boundary: return HTTP 400 if `customerId` is missing or not a valid identifier. |
| 6 | **High** | Performance / Scalability | Unbounded `SELECT` query lacks pagination (`LIMIT`/`OFFSET` or cursor), risking severe memory and latency degradation. | `src/orders.js:6` (`SELECT id, customer_id, total_minor, placed_at FROM orders WHERE customer_id = $1 ORDER BY placed_at DESC`). | Add mandatory `LIMIT` (with default page size, e.g. 50) and cursor/offset pagination to `listOrders`. |
| 7 | **Medium** | Correctness / Validation | `POST /orders` validation permits negative or zero `totalMinor` amounts and arbitrary non-string `customerId` types. | `src/app.js:9` (`!req.body?.customerId || !Number.isInteger(req.body?.totalMinor)`). Negative integers satisfy `Number.isInteger`. | Enforce strict schema validation: ensure `typeof customerId === 'string'`, `customerId.trim().length > 0`, and `totalMinor > 0`. |
| 8 | **Medium** | Test Coverage | Test suite passes but provides zero test coverage for API routes, database functions, and validation logic. | `test/orders.test.js:5-9` only tests `formatMinor`. Neither `src/app.js` nor `src/orders.js` is imported or tested. | Implement integration and unit tests for `GET /orders` and `POST /orders` covering validation, successful paths, and error conditions. |
| 9 | **Medium** | Operability | Missing health check (`/healthz`) and readiness (`/readyz`) probe endpoints required for container orchestration. | `src/app.js:4-15` (flagged by `check-operability` `O-health-endpoint`). | Add `/healthz` (liveness: process running) and `/readyz` (readiness: pool connectivity verified via `SELECT 1`) endpoints. |
| 10 | **Medium** | Operability | Missing graceful shutdown handling (`SIGTERM`/`SIGINT`) and pool drainage. | `src/app.js:17` directly calls `createApp().listen(...)` without signal listeners or `pool.end()`. | Handle `SIGTERM` and `SIGINT` to stop accepting new requests, allow in-flight requests to complete, and close `pool`. |
| 11 | **Medium** | Release Engineering | Missing lockfile (`package-lock.json`) prevents reproducible builds and blocks dependency vulnerability audits. | `package.json:1-8` has no sibling `package-lock.json`. `npm audit` fails with `ENOLOCK`. | Run `npm install --package-lock-only` and commit `package-lock.json` to source control. |
| 12 | **Low** | Maintainability | `src/format.js` is dead code within the runtime service. | `src/format.js:1-6` is only imported by `test/orders.test.js:3`; never used in `src/app.js` or `src/orders.js`. | Either integrate `formatMinor` into order presentation responses or remove it if currency formatting belongs to client consumers. |
| 13 | **Low** | Documentation | `README.md` makes inaccurate assertions regarding input validation at boundaries. | `README.md:5` states "Input is validated at the boundary in `src/app.js`", which is untrue for `GET /orders`. | Update `README.md` to reflect actual boundary behavior and API contract requirements. |
| 14 | **Info** | Security | Parameterized SQL queries are utilized throughout database functions, preventing SQL injection on existing queries. | `src/orders.js:6, 11-14` uses `$1, $2` parameters. | Maintain parameterized query discipline on any future query additions. |
| 15 | **Info** | Architecture | Clean separation between HTTP transport routing and database query execution; zero circular dependencies. | `src/app.js` handles Express routes; `src/orders.js` encapsulates database interactions. | Maintain clean boundary separation as service features expand. |

---

## 5. Performance & Operational Triad (Theory vs. Practice)

### Database Querying (`listOrders`)
1. **Theoretical Maximum**: Memory-speed streaming of indexed tuples from PostgreSQL to Node.js in single-digit milliseconds.
2. **Expected Real-World**: High latency (hundreds of milliseconds to seconds) and high Node heap pressure under accounts with hundreds or thousands of orders; potential `OutOfMemoryError` under concurrent load.
3. **Friction Bottlenecks**: Lack of `LIMIT`/pagination forces full result set transfer over the wire and in-memory JSON serialization of arbitrary payload sizes in V8 heap. Lack of an explicit verified index on `(customer_id, placed_at DESC)` forces sequential table scans or large in-memory sorts.

### Nightly Retention Purge (`migrations/0004_orders_retention.sql`)
1. **Theoretical Maximum**: Instantaneous bulk deletion of expired tuples.
2. **Expected Real-World**: Failure on night 2 after column drop; table lock contention and disk I/O spikes during unindexed multi-row deletion on night 1.
3. **Friction Bottlenecks**: Exclusive schema locks during `ALTER TABLE`, lack of batching (`DELETE ... LIMIT`) causing table/row lock contention, and absence of an index on `placed_at`.

---

## 6. Unconfirmed Issues / Requires Investigation

1. **Table Schema and Indexing Strategy**:
   - *Observation*: Initial migration files (`0001` through `0003`) are missing from the repository.
   - *Risk*: Without schema definitions, it cannot be verified whether indexes exist on `orders(customer_id, placed_at DESC)` or `orders(placed_at)`. Missing indexes will turn both `listOrders` and the nightly `DELETE` into costly sequential table scans.
   - *Required Investigation*: Platform team or DBA must inspect target PostgreSQL database catalog (`\d orders`).
2. **Database Connection Pool Sizing and Timeouts**:
   - *Observation*: `pg.Pool` is initialized with default connection settings (`max: 10`, default connection timeout, no statement timeout).
   - *Risk*: Slow or stalled database queries can saturate the pool, causing cascading request timeouts across all application instances.
   - *Required Investigation*: Tune `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`, and query statement timeouts according to production database capacity.

---

## 7. Summary

### Strengths
- **Parameterized SQL**: All database operations (`SELECT`, `INSERT`) in `src/orders.js` use parameterized bindings, avoiding SQL injection vulnerabilities.
- **Architectural Separation**: Clean boundary separation between HTTP handling (`src/app.js`) and database access (`src/orders.js`), with no circular dependencies.

### Key Risks
- **Data Loss & Nightly Workflow Failure (Findings 1, 2)**: The nightly retention job runs destructive DDL that permanently deletes column data and is guaranteed to fail on subsequent runs. Concurrently, backup restoration verification is disabled.
- **Service Instability under Error Conditions (Findings 3, 4, 5)**: Unhandled promise rejections in Express 4 and missing pool error handlers leave the Node process prone to silent hangs or crashes upon database or client errors.
- **Unbounded Queries & Missing Operability Hooks (Findings 6, 9, 10, 11)**: The service lacks health check endpoints, graceful shutdown, query pagination, and dependency lockfiles required for safe production deployment.

### Priority Order for Remediation
1. **Remove DDL from retention script**: Delete `ALTER TABLE orders DROP COLUMN legacy_reference;` from `migrations/0004_orders_retention.sql` before running the scheduled workflow.
2. **Fix Express 4 error handling and input validation**:
   - Add error handling / async wrappers to `GET /orders` and `POST /orders`.
   - Validate `req.query.customerId` (return HTTP 400 if missing or invalid).
   - Validate `totalMinor > 0` on `POST /orders`.
3. **Attach error listener to PostgreSQL pool**: Add `pool.on('error', ...)` in `src/orders.js`.
4. **Implement Operability Primitives**:
   - Add `/healthz` and `/readyz` endpoints to `src/app.js`.
   - Add `SIGTERM`/`SIGINT` graceful shutdown handling closing server and database pool.
5. **Add Query Pagination**: Introduce `LIMIT` and cursor/page controls to `listOrders`.
6. **Generate lockfile & enable restore verification**:
   - Generate and commit `package-lock.json` and run `npm audit`.
   - Re-enable and test `scripts/restore-check.sh`.
7. **Expand Test Coverage**: Add integration tests exercising `GET /orders` and `POST /orders`.

### Coverage Gaps
- **Database Catalog State**: Live PostgreSQL instance catalog could not be inspected to verify existing constraints, types, and index coverage.
- **Load & Concurrency Testing**: No load or saturation testing was performed to benchmark connection pool behavior under high concurrency.
- **Historic Migrations**: Migrations 0001–0003 were not available in the repository.
