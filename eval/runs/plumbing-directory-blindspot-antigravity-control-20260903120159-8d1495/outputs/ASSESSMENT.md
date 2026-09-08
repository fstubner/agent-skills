# Engineering Assessment: Orders Service

## 1. Scope
- **Target**: Orders Service (`orders-api`) codebase in `C:\tmp\agent-skills-eval-paC2YL\workspace`.
- **In Scope**:
  - Entry points & API handling: `src/app.js`
  - Business logic & Database access: `src/orders.js`
  - Utility functions: `src/format.js`
  - Migration scripts: `migrations/0004_orders_retention.sql`
  - Maintenance scripts: `scripts/restore-check.sh`
  - Test suite: `test/orders.test.js`
  - Configuration & Documentation: `package.json`, `README.md`
- **Out of Scope**:
  - External PostgreSQL database instance and infrastructure runtime environment.
  - Production deployment manifests / CI pipelines (not present in repository).
- **Depth**: `targeted` (Every file in the repository was opened and examined in full).

## 2. Environment
- **Language / Runtime**: JavaScript (Node.js ES modules, `"type": "module"`)
- **Frameworks & Core Libraries**: Express `^4.19.0`, `pg` `^8.11.0`
- **Domain**: RESTful HTTP API service for managing customer orders
- **Build & Test Tooling**: Node.js native test runner (`node --test`), npm scripts

## 3. Tooling Results

### What I Ran

#### 1. `npm test`
- **Command**: `npm test`
- **Outcome**: Success (Exit code 0)
- **Output**:
```
> test
> node --test test/orders.test.js

✔ minor units render as a decimal amount (0.6824ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 141.3381
```

#### 2. Linter / Static Analysis / Type Checkers
- **Command**: None configured in `package.json`.
- **Outcome**: Unavailable (No ESLint, Prettier, TypeScript, or audit scripts defined).

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|-----------|----------------|
| 1 | **Critical** | Reliability / Backup | Backup restore verification script is disabled and hardcoded to exit 0 | `scripts/restore-check.sh:4` — `exit 0` with comment stating disabled due to CI timeouts. | Re-enable restore verification using a smaller fixture database or async backup test pipeline. |
| 2 | **Critical** | Data Integrity | SQL Migration script contains destructive DML data deletion (`DELETE FROM orders`) | `migrations/0004_orders_retention.sql:3` — `DELETE FROM orders WHERE placed_at < now() - interval '90 days';` | Remove DML data deletion from migration DDL scripts. Move data retention logic strictly to scheduled database maintenance tasks. |
| 3 | **High** | Reliability | Express 4 async route handlers lack error handling, causing unhandled promise rejections on DB failure | `src/app.js:7,8-13` — Async handlers return `await pool.query(...)` directly without `try/catch` or `next(err)`. | Wrap async handlers in try-catch blocks or use an async error handler middleware (`express-async-errors`) to return HTTP 500 cleanly on DB errors. |
| 4 | **High** | Correctness / Security | Missing input validation on `GET /orders` endpoint | `src/app.js:7` — `listOrders(req.query.customerId)` passes `req.query.customerId` directly without checking presence or type. | Validate that `req.query.customerId` is present and valid before querying the database; return HTTP 400 if missing. |
| 5 | **High** | Maintainability / Reliability | Test suite coverage gap: zero HTTP API routes or database queries are tested | `test/orders.test.js:5-9` — Tests only `formatMinor` utility function; `src/app.js` and `src/orders.js` have 0% test coverage. | Add integration tests for `GET /orders` and `POST /orders` endpoints, including validation and failure cases. |
| 6 | **Medium** | Documentation / Maintainability | Migration script and README make contradictory claims regarding data retention and missing CI workflow | `migrations/0004_orders_retention.sql:1-2` references `.github/workflows/retention.yml` (directory does not exist); `README.md:8` claims retention is external while `0004_orders_retention.sql` deletes data. | Reconcile data retention policy documentation and ensure referenced GitHub Actions workflows exist. |
| 7 | **Medium** | Architecture | Dead code: `formatMinor` utility is defined and tested but never used in API responses | `src/format.js:1-5` & `test/orders.test.js:3-9` vs `src/app.js:7,12` — API endpoints return raw database rows without formatting amounts. | Either integrate `formatMinor` into API response formatters or document that client applications perform formatting. |
| 8 | **Medium** | Correctness | `POST /orders` validation permits negative or zero `totalMinor` amounts | `src/app.js:9` — `!Number.isInteger(req.body?.totalMinor)` permits negative integers and zero for order totals. | Update validation to enforce `totalMinor > 0`. |
| 9 | **Low** | Architecture / Reliability | Module-level database pool initialization prevents clean configuration and test isolation | `src/orders.js:3` — `const pool = new pg.Pool(...)` executes on module import. | Allow pool initialization via factory function or dependency injection to facilitate testing and lifecycle management. |

---

## 5. Unconfirmed Issues

- **Database Indexing**: Unable to verify if an index on `(customer_id, placed_at)` exists because initial migration scripts (`0001`–`0003`) are missing from the `migrations/` directory. If missing, `listOrders` queries will perform full table scans as the `orders` table grows.

---

## 6. Summary

### Strengths
- **Parameterized Database Queries**: All database operations in `src/orders.js` (`SELECT` and `INSERT`) use parameterized queries (`$1`, `$2`), effectively preventing SQL injection vulnerabilities.
- **Clean Function Separation**: Clean separation between HTTP routing (`src/app.js`), database interaction (`src/orders.js`), and formatting logic (`src/format.js`).

### Key Risks
- **Disabled Disaster Recovery Verification (Finding #1)**: The backup restore check script is turned into a no-op (`exit 0`), creating significant operational risk if database backups are corrupted or un-restorable.
- **Destructive SQL Migration (Finding #2)**: Data deletion logic embedded directly in schema migration files risks unintended data loss when migrations run across environments.
- **API Instability & Unhandled Rejections (Finding #3, #4)**: Missing async error catching in Express 4 route handlers and unvalidated `GET /orders` parameters expose the service to crash risks or unhandled 500 errors.

### Priority Order
1. **Fix Restore Verification (Finding #1)**: Re-enable `scripts/restore-check.sh` with a smaller test dataset so backup integrity is verified automatically.
2. **Remove Data Deletion from Migration (Finding #2)**: Remove `DELETE FROM orders` from `migrations/0004_orders_retention.sql`.
3. **Add Error Handling to HTTP Handlers (Finding #3)**: Implement try/catch blocks or an async error middleware in `src/app.js` to catch database errors.
4. **Validate `GET /orders` Query Parameters (Finding #4 & Finding #8)**: Enforce mandatory parameter validation for `customerId` and validate positive integer bounds for `totalMinor`.
5. **Expand Test Coverage (Finding #5)**: Add API test coverage for HTTP endpoints in `test/orders.test.js`.
6. **Clean Up Codebase Discrepancies (Finding #6, #7, #9)**: Resolve dead utility code, align documentation, and refactor database pool lifecycle management.

### Coverage Gaps
- **Live Database Behavior**: Database queries were evaluated via static code analysis; live query execution plans and index usage could not be inspected without a running PostgreSQL environment.
- **CI/CD Pipelines & Operational Monitoring**: GitHub Actions workflows (`.github/`) and infrastructure configuration files are absent from the repository.
- **Static Analysis Tools**: ESLint, TypeScript/type checking, and security scanners (`npm audit`) are not configured in the workspace and were not executed.
