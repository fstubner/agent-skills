# Orders Service Engineering Assessment

## Scope and approach

**Depth:** targeted. I read every application, test, migration, operational script, workflow, and project metadata file in the repository.

**In scope:** `src/`, `test/`, `migrations/`, `scripts/`, `.github/workflows/retention.yml`, `README.md`, and `package.json`.

**Out of scope:** deployment infrastructure not present, production database/configuration, external authentication gateways, production data/metrics, and live database behavior.

## What I ran

| Command | Result |
|---|---|
| `npm test` | Passed: 1 test, 1 pass, 0 failures. |
| `npm audit --omit=dev` | Failed: exit 1, no lockfile (`ENOLOCK`). |
| `npm run build` | Failed: exit 1, script is not defined. |
| `npm run lint` | Failed: exit 1, script is not defined. |
| `npm run typecheck` | Failed: exit 1, script is not defined. |
| `npm run format:check` | Failed: exit 1, script is not defined. |
| `bash scripts/restore-check.sh` | Exited 0 without performing a check. |
| `node --check src/app.js`, `src/orders.js`, `src/format.js` | Syntax checks passed. |

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---:|---|---|---|---|---|
| 1 | High | Reliability | Database failures from HTTP handlers are not converted into responses. | `src/app.js:7-12` uses async route callbacks without `try/catch` or error middleware; `src/orders.js:6,11-15` awaits queries without handling rejection. | Add centralized async error forwarding and safe 5xx responses, with logging/correlation IDs; test database rejection paths. |
| 2 | High | Data integrity / Operations | The scheduled retention command can partially apply a destructive operation. | `.github/workflows/retention.yml:13-16` runs SQL against `PRODUCTION_DATABASE_URL`; `migrations/0004_orders_retention.sql:3-5` deletes rows then drops a column without an explicit transaction or recovery guard. | Separate recurring purge from schema migration; add reviewed row-count/dry-run safeguards, transaction strategy, and documented restore/rollback procedure. |
| 3 | High | Backup / Operations | Restore verification is disabled while reporting success. | `scripts/restore-check.sh:2-4` states it is disabled and immediately runs `exit 0`; no other restore tests exist. | Re-enable a bounded fixture restore test, or make the disabled state fail visibly and provide compensating backup validation. |
| 4 | Medium | Input validation / Correctness | POST validation does not enforce types, ranges, or monetary invariants. | `src/app.js:9-10` accepts any truthy `customerId` and any integer `totalMinor`, including negative and unsafe integers; `src/orders.js:12-13` persists them. | Require a bounded string customer ID and safe, non-negative monetary integer (or document allowed semantics); test malformed and boundary JSON. |
| 5 | Medium | Test coverage | The passing suite does not exercise the orders API or database behavior. | `test/orders.test.js:5-9` has one formatter test; no tests cover `src/app.js` or `src/orders.js`. | Add request-level success/validation tests, database failure tests, and retention/migration tests. |
| 6 | Medium | Dependency / Supply chain | Dependencies are not reproducibly resolved and cannot be audited by the declared audit command. | `package.json:7` uses semver ranges; no lockfile exists; `npm audit --omit=dev` returned `ENOLOCK`. | Commit a lockfile, pin supported Node/npm versions in CI, and audit the locked graph. |

## Unconfirmed / Requires Investigation

- **Authentication/authorization:** `src/app.js:7-12` contains no auth or ownership checks. A platform gateway may provide them, but that was unavailable to inspect. Verify ingress identity propagation and customer ownership; elevate to Critical if directly exposed.
- **Schema compatibility:** `src/orders.js:6,12` assumes an `orders` schema not defined here. Verify the authoritative schema and migration history.
- **Formatting limits:** `src/format.js:3-4` uses `Math.abs` and is not tested at numeric limits. Confirm API/database bounds.

## Strengths

- Both queries use parameters (`src/orders.js:6,12-14`), avoiding SQL interpolation.
- HTTP wiring, persistence, and formatting are separated into small modules (`src/app.js`, `src/orders.js`, `src/format.js`).
- The test command and syntax checks pass; the formatter test covers positive, small, and negative values (`test/orders.test.js:5-9`).

## Key Risks

The immediate platform risks are unhandled database errors (1), a production-scheduled destructive SQL file with partial-apply risk (2), and a restore check that succeeds without checking restoreability (3). Findings 4-6 increase invalid-data, regression, and dependency-drift risk.

## Priority Order

1. Add and test centralized database/HTTP error handling (Finding 1).
2. Redesign retention with transaction and recovery safeguards (Finding 2).
3. Restore meaningful backup verification (Finding 3).
4. Tighten validation and add API/database tests (Findings 4-5).
5. Add a lockfile and dependency audit in CI (Finding 6).

## Coverage Gaps

- No live PostgreSQL, authoritative schema, production ingress, or deployment configuration was available; database execution and auth posture were not verified.
- No load, concurrency, failure-injection, penetration, backup/restore, or production-like end-to-end testing was performed.
- Build, lint, type-check, and format-check scripts are absent; dependency audit could not run without a lockfile.
- The restore script was executed, but its implementation performs no verification.
- No files outside the listed repository scope were examined.
