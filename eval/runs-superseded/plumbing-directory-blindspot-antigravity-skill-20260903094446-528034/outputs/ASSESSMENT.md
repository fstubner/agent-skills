# Engineering Assessment: Orders Service

**Date**: 2026-09-03  
**Target**: Orders API (`orders-api`)  
**Assessor**: Antigravity  
**Target Audience**: Platform Engineering Team  

---

## 1. Scope

- **In Scope**:
  - Configuration & metadata: `package.json`, `README.md`
  - Application source: `src/app.js`, `src/orders.js`, `src/format.js`
  - Automated test suite: `test/orders.test.js`
  - Database migrations: `migrations/0004_orders_retention.sql`
  - Maintenance & operational scripts: `scripts/restore-check.sh`
  - Continuous integration & operational workflows: `.github/workflows/retention.yml`
- **Out of Scope**:
  - Infrastructure-as-code and live deployment infrastructure (no Terraform, Helm, or Kubernetes manifests present in repository).
  - Upstream authentication providers or API gateway configuration (not present in workspace).
- **Depth**: `deep` — every in-scope file read in full, all declared project scripts and available static analysis checks executed, outputs recorded.

### Enumeration of Workspace Files Scanned Before Assessment

| File Path | Description |
|---|---|
| `package.json` | Project manifest and runtime dependencies |
| `README.md` | Service description and claims |
| `src/app.js` | Express application definition and HTTP route handlers |
| `src/orders.js` | Database queries and connection pool instantiation |
| `src/format.js` | Currency unit formatting utility |
| `test/orders.test.js` | Node test runner unit tests |
| `migrations/0004_orders_retention.sql` | Retention data deletion and DDL schema migration |
| `scripts/restore-check.sh` | Database backup restore verification script |
| `.github/workflows/retention.yml` | Nightly retention cron workflow |

---

## 2. Environment

- **Languages & Runtimes**: Node.js (tested on v24.14.1), JavaScript (ES Modules, `"type": "module"`).
- **Frameworks & Libraries**: Express `^4.19.0`, `pg` (node-postgres) `^8.11.0`.
- **Database**: PostgreSQL (dialect inferred from `pg` client and `psql` invocation).
- **Domain**: E-commerce / Billing orders microservice.
- **Platform Targets**: Containerized / server backend service.
- **Tooling & Checkers**: Native `node:test` runner, npm, agent-skills static checkers (`check-migrations`, `check-backend`, `check-organization`, `check-smells`, `check-operability`).

---

## 3. Tooling Results

### What I Ran

#### 1. Project Test Suite (`npm test`)
- **Command**: `npm test`
- **Exit Code**: `0`
- **Output**:
```text
> test
> node --test test/orders.test.js

✔ minor units render as a decimal amount (1.4808ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 161.3536
```

#### 2. Project Start Command (`npm start`)
- **Command**: `npm start`
- **Exit Code**: `1`
- **Output**:
```text
> start
> node src/app.js

node:internal/modules/package_json_reader:301
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'express' imported from C:\tmp\agent-skills-eval-NIanWV\workspace\src\app.js
...
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v24.14.1
```
*(Dependencies not installed in workspace; `node_modules/` absent).*

#### 3. Security Audit (`npm audit`)
- **Command**: `npm audit`
- **Exit Code**: `1`
- **Output**:
```text
npm error code ENOLOCK
npm error audit This command requires an existing lockfile.
npm error audit Try creating one first with: npm i --package-lock-only
npm error audit Original error: loadVirtual requires existing shrinkwrap file
```

#### 4. Migration Safety Checker (`check-migrations.js`)
- **Command**: `node .../check-migrations.js --json .`
- **Exit Code**: `1`
- **Verdict**: `BLOCK`
- **Report Summary**:
```json
{
  "schemaVersion": 1,
  "skill": "data-modeling",
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

#### 5. Backend Safety Checker (`check-backend.js`)
- **Command**: `node .../check-backend.js --json .`
- **Exit Code**: `0`
- **Verdict**: `SHIP`
- **Report Summary**:
```json
{
  "schemaVersion": 1,
  "skill": "backend-engineering",
  "verdict": "SHIP",
  "checks": [
    { "id": "B-arch-doc", "status": "pass", "detail": "single-part server; architecture doc not required" },
    { "id": "B-dual-orm", "status": "pass", "detail": "no orm detected" },
    { "id": "B-client-secrets", "status": "pass", "detail": "no secrets in client-reachable paths (gitleaks)" },
    { "id": "B-session-cookie", "status": "pass", "detail": "no session cookie set without HttpOnly/Secure/SameSite (4 source file(s) scanned)" }
  ]
}
```

#### 6. Code Organization Checker (`check-organization.js`)
- **Command**: `node .../check-organization.js --json .`
- **Exit Code**: `0`
- **Verdict**: `SHIP`
- **Report Summary**:
```json
{
  "schemaVersion": 1,
  "skill": "code-organization",
  "verdict": "SHIP",
  "checks": [
    { "id": "O-circular-deps", "status": "pass", "detail": "4 file(s) scanned, no circular imports" }
  ]
}
```

#### 7. Code Smells Checker (`check-smells.js`)
- **Command**: `node .../check-smells.js --json .`
- **Exit Code**: `0`
- **Verdict**: `SHIP`
- **Report Summary**:
```json
{
  "schemaVersion": 1,
  "skill": "code-smells",
  "verdict": "SHIP",
  "checks": [
    { "id": "S-large-file", "status": "pass", "detail": "no file over 400 lines (4 file(s) scanned)" },
    { "id": "S-deep-nesting", "status": "pass", "detail": "no nesting deeper than 5 (4 file(s) scanned)" }
  ]
}
```

#### 8. Operability Checker (`check-operability.js`)
- **Command**: `node .../check-operability.js --json .`
- **Exit Code**: `1`
- **Verdict**: `BLOCK`
- **Report Summary**:
```json
{
  "schemaVersion": 1,
  "skill": "release-engineering",
  "verdict": "BLOCK",
  "checks": [
    {
      "id": "O-operations-doc",
      "status": "fail",
      "detail": "no OPERATIONS.md — a running service with no written signals, alerts, failure modes or recovery is operable only by whoever built it"
    },
    {
      "id": "O-health-endpoint",
      "status": "fail",
      "detail": "no health or readiness endpoint found; a deploy gate cannot observe health it cannot ask for"
    }
  ]
}
```

### Tool Execution Summary

- **Tools Run Successfully**:
  - `npm test`: Passed 1 test in 161ms.
  - `check-backend.js`: Passed with verdict `SHIP`.
  - `check-organization.js`: Passed with verdict `SHIP`.
  - `check-smells.js`: Passed with verdict `SHIP`.
- **Tools That Failed**:
  - `npm start`: Failed with `ERR_MODULE_NOT_FOUND` (dependencies not installed).
  - `npm audit`: Failed with `ENOLOCK` (no `package-lock.json`).
  - `check-migrations.js`: Failed with verdict `BLOCK` (`DM-sql-destructive-drop`).
  - `check-operability.js`: Failed with verdict `BLOCK` (`O-operations-doc`, `O-health-endpoint`).
- **Tools Unavailable**:
  - Type checking (`tsc`): Not configured in `package.json`.
  - Linting (`eslint`): Not configured in `package.json`.
  - Formatting (`prettier`): Not configured in `package.json`.
- **Tools Not Attempted**:
  - `check-frontend.js`: Out of scope (backend API service, no frontend code).

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | **Critical** | Reliability / Data Integrity | Nightly retention cron re-runs destructive DDL `ALTER TABLE DROP COLUMN` and deletes orders directly in production | `migrations/0004_orders_retention.sql:3,5`, `.github/workflows/retention.yml:16` | Separate data purge (DML) from schema migrations (DDL). Move retention purge into an idempotent stored procedure or scheduled job script. Never re-execute migration files in a cron job. |
| 2 | **Critical** | Reliability / Data Integrity | Backup restore verification is completely faked with an unconditional `exit 0` | `scripts/restore-check.sh:1-4` | Re-enable automated restore verification against a sanitized fixture dump before running retention or handing off to the platform team. |
| 3 | **Critical** | Security | Unauthenticated API endpoints allow unauthorized access to any customer's orders (IDOR) | `src/app.js:7, 8-13` | Enforce authentication middleware (e.g. JWT / session) and authorize `req.user.id === customerId` before executing queries. |
| 4 | **High** | Reliability | Unhandled async promise rejections crash the Node.js server process | `src/app.js:7, 12` | Wrap async route handlers in `try/catch` or use an Express async router wrapper (`express-async-errors` or migrate to Express 5). Provide central error handling middleware. |
| 5 | **High** | Reliability / Correctness | Missing input validation on `GET /orders` crashes server when `customerId` query parameter is omitted | `src/app.js:7`, `src/orders.js:6` | Validate `req.query.customerId` at the route boundary before calling `listOrders`. Return `400 Bad Request` if missing or malformed. |
| 6 | **High** | Reliability / Performance | Unbounded `listOrders` query without `LIMIT` or pagination risks memory saturation and event loop lag | `src/orders.js:6` | Implement cursor or keyset pagination with a strict maximum `LIMIT` (e.g., default 50, max 100). |
| 7 | **High** | Architecture / Reliability | Incomplete migration history and absence of schema creation scripts or migration tooling | `migrations/` directory (only `0004` exists), `package.json:5` | Commit baseline migrations (`0001_initial_schema.sql` defining `orders` table) and adopt a standard migration runner (e.g. `node-pg-migrate`). |
| 8 | **High** | Security / CI/CD | GitHub Actions workflow directly connects to production database via raw `psql` using full-access `DATABASE_URL` | `.github/workflows/retention.yml:14-16` | Restrict database permissions to a dedicated role with least privilege (`DELETE` only on `orders`), or execute retention via internal scheduled database tasks instead of GitHub runners. |
| 9 | **High** | Maintainability / Quality | Deceptive test suite testing dead utility code; zero test coverage for actual service routes and database operations | `test/orders.test.js:1-10`, `src/format.js:1-6` | Write integration tests for `createApp()` covering `GET /orders`, `POST /orders`, input validation edge cases, and database error states. |
| 10 | **Medium** | Correctness | `POST /orders` accepts negative or zero order totals | `src/app.js:9` | Update validation: `Number.isInteger(req.body?.totalMinor) && req.body.totalMinor > 0`. |
| 11 | **Medium** | Reliability | Unhandled PostgreSQL pool error events and top-level database pool instantiation | `src/orders.js:3` | Register `pool.on('error', (err) => logger.error(err))` to prevent unhandled EventEmitter error crashes, and manage pool lifecycle in application factory. |
| 12 | **Medium** | Operability | Missing health/readiness endpoints and absence of graceful shutdown handlers | `src/app.js:4-17` | Add `/healthz` and `/readyz` endpoints checking DB connectivity; handle `SIGTERM`/`SIGINT` to gracefully drain HTTP connections and close `pool.end()`. Create `OPERATIONS.md`. |
| 13 | **Medium** | Dependencies | Missing `package-lock.json` prevents `npm audit` and causes non-deterministic deployments | `package.json:1-7` | Commit `package-lock.json` to lock dependency trees and enable CI vulnerability scanning. |
| 14 | **Low** | Maintainability | Dead code `src/format.js` is unreferenced by the application | `src/format.js:1-6` | Integrate `formatMinor` into the orders response payload or remove it if currency formatting belongs in clients. |
| 15 | **Low** | Tooling | Missing linter, code formatter, and build/type-check scripts | `package.json:5` | Add ESLint, Prettier, and TypeScript/JSDoc type checking scripts to CI pipelines. |

---

## 5. Unconfirmed Issues

1. **Database Indexing on `orders` Table**:
   - **Hypothesis**: The query `SELECT ... WHERE customer_id = $1 ORDER BY placed_at DESC` requires a composite index on `(customer_id, placed_at DESC)` to avoid sequential table scans.
   - **Unconfirmed Status**: Because migrations `0001` through `0003` are missing and no live database access was provided, the presence of indexes cannot be confirmed from source files alone.
   - **Information Needed**: Baseline DDL migration scripts or database catalog dump (`\d orders`).

2. **Upstream API Gateway Authentication**:
   - **Hypothesis**: Authentication and authorization may be handled by an external ingress gateway (e.g., Kong, Envoy, AWS API Gateway) that strips or validates headers before reaching this service.
   - **Unconfirmed Status**: The repository contains no gateway configuration or headers check (e.g. `x-user-id` verification). If deployed bare or misconfigured, it is vulnerable to IDOR.
   - **Information Needed**: Platform network topology and gateway specifications.

---

## 6. Summary

### Strengths

1. **Parameterized Database Queries**:
   In `src/orders.js` lines 6 and 11-14, all user-supplied variables (`customerId`, `totalMinor`) are passed using PostgreSQL parameterized placeholders (`$1`, `$2`), preventing SQL string concatenation injection.
2. **Clean Modular Structure**:
   `src/app.js` exports a reusable `createApp()` factory function (lines 4-15) distinct from the server startup conditional (line 17), adhering to single-responsibility module isolation.

### Key Risks

1. **Catastrophic Scheduled Job Failure & Data Deletion (Findings 1, 2, 8)**:
   The nightly GitHub Actions retention workflow executes `0004_orders_retention.sql` directly against `PRODUCTION_DATABASE_URL`. This deletes rows and repeatedly attempts to drop column `legacy_reference`, while backup restore validation (`restore-check.sh`) is disabled.
2. **Process Crashes on Everyday Faults (Findings 4, 5, 11)**:
   Due to unhandled async promise rejections in Express 4 and missing pool error listeners, a single request with a missing `customerId` or a momentary database blip will crash the Node.js process.
3. **Severe Security Exposure (Finding 3)**:
   Absence of any authentication or authorization allows any unauthenticated party on the network to read or place orders for any customer.
4. **False Quality Assurance (Finding 9)**:
   The repository claims "the test suite passes", but the test suite tests only an unused 6-line utility function.

### Priority Order

1. **Priority 1: Fix Retention and Migration Pipelines (Findings 1, 2, 7, 8)**
   - Remove `0004_orders_retention.sql` from the nightly GitHub Actions workflow.
   - Separate DDL schema migration from data retention jobs.
   - Re-enable real backup restore testing in `scripts/restore-check.sh`.
   - Provide complete baseline migrations and install a migration runner.
2. **Priority 2: Secure Endpoints & Eliminate Process Crash Vectors (Findings 3, 4, 5, 10, 11)**
   - Add authentication/authorization middleware to `/orders`.
   - Handle async errors in Express route handlers to prevent unhandled rejection process crashes.
   - Validate `req.query.customerId` on `GET /orders` and enforce `totalMinor > 0` on `POST /orders`.
   - Add `pool.on('error')` handler.
3. **Priority 3: Operability & Platform Readiness (Findings 6, 12, 13)**
   - Add `/healthz` and `/readyz` endpoints with DB ping.
   - Implement graceful shutdown on `SIGTERM` / `SIGINT`.
   - Add pagination / limits to `listOrders`.
   - Commit `package-lock.json` and document operational runbooks in `OPERATIONS.md`.
4. **Priority 4: Quality & Verification (Findings 9, 14, 15)**
   - Implement comprehensive integration tests covering API route behaviors, database operations, and failure modes.
   - Clean up dead code (`src/format.js`) and configure linting.

### Coverage Gaps

- **Production Configuration & Infrastructure**: No Kubernetes manifests, Helm charts, Dockerfiles, or Terraform configurations were in scope.
- **Database Catalog**: Missing migrations 0001–0003 prevented verification of foreign keys, unique constraints, and indexes on `orders`.
- **Performance & Load Testing**: No benchmark or load tests were executed to measure query latency or memory consumption under high order volume.
- **Network & Gateway Security**: Ingress controls, TLS termination, and network policies outside the microservice were not evaluated.