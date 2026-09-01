# Orders service assessment

## Recommendation

**Do not hand this service to the platform team as production-ready.** The implementation is a small, understandable starting point, but it is missing critical trust-boundary, failure-handling, operational, and deployment evidence. The happy-path business logic is not enough to establish service readiness.

## Verified findings

### High priority

- **Customer order access is unauthorised at the HTTP boundary.** `GET /orders` accepts any `customerId` and queries that customer’s records. There is no authentication or authorization context, tenant check, or ownership check. If this endpoint is externally reachable, a caller can enumerate another customer’s orders by changing the query parameter. The POST endpoint likewise accepts an arbitrary customer ID without authorization.

- **The GET input boundary is not validated.** `GET /orders` passes `req.query.customerId` directly to the database. Missing values, repeated query parameters, empty strings, and unexpected types are not rejected with a deliberate 4xx response. Define the accepted format and enforce it before querying.

- **Unhandled asynchronous failures can become 5xx responses without a controlled contract.** Both route handlers await database operations without route-level or application-level error middleware. Database outages, timeouts, constraint errors, and malformed JSON are not mapped to stable client-safe responses or logged with correlation context. Confirm the Express behavior under rejected promises for the deployed Express version, then add explicit centralized handling.

- **Order validation is materially incomplete.** POST checks only truthiness of `customerId` and integer-ness of `totalMinor`. It permits whitespace-only or non-string customer IDs, negative totals, zero (if not intended), unsafe integers beyond JavaScript’s exact integer range, and arbitrary extra fields. It also does not establish a maximum amount. The API contract should specify and enforce these constraints, with database constraints as a second line of defense.

### Medium priority

- **No request limits or abuse controls are visible.** `express.json()` has no documented size limit, and there is no rate limiting, pagination, query result cap, timeout policy, or backpressure behavior. A customer with a large history can cause an unbounded response and query cost.

- **The list ordering is not deterministic for equal timestamps.** Results are ordered only by `placed_at DESC`; orders sharing a timestamp can change order between requests. Add a stable secondary key if clients rely on repeatable pagination or presentation.

- **Database lifecycle and readiness are not addressed.** A module-global pool is created, but there is no graceful shutdown, pool sizing/timeout configuration, readiness/liveness endpoint, startup database check, or documented migration execution/compatibility procedure.

- **Retention controls are inconsistent with the repository contents.** `migrations/0004_orders_retention.sql` performs a destructive delete and drops `legacy_reference`, while its comment refers to `.github/workflows/retention.yml`; that workflow is not present in this workspace. The migration is not an additive rolling-deploy change: dropping a column can break an older application during a mixed-version rollout. The retention job, schedule, authorization, monitoring, and rollback strategy need to be supplied and verified by the platform team.

- **The restore verification is disabled.** `scripts/restore-check.sh` exits successfully without doing any restore check and says the check was disabled due to CI timeout. Backup recoverability is therefore unverified, despite retention deleting data.

- **There is no dependency lockfile or reproducible build evidence.** The repository contains `package.json` but no lockfile in the visible workspace. The package specifies semver ranges, so installs can resolve different dependency versions. Pin and record dependencies, and define a build/release verification step.

### Low priority

- **The only automated test covers formatting.** There are no HTTP integration tests, database tests, authorization tests, validation/failure-path tests, migration tests, or retention/restore tests. The README claim that “the test suite passes” is true for the single formatting test but does not demonstrate service behavior.

- **`formatMinor` is currently unused by the API.** If monetary display formatting is a supported concern, define whether the API returns minor units only or also formatted values. Validate inputs before calling this helper; `Math.abs` and arithmetic are not suitable for values outside the safe integer range.

- **The API contract is underspecified.** There are no documented response schemas, status codes, error shape, idempotency behavior, duplicate-order semantics, or API versioning/compatibility expectations.

## Positive observations

- SQL values in the two database queries are parameterized.
- The service uses minor units for persisted totals, avoiding floating-point currency arithmetic in the shown database path.
- The code is compact, and the existing JavaScript syntax checks and test suite pass.

## Required handoff evidence

Before acceptance, provide or verify:

1. Authentication and per-customer authorization design, including the trusted identity source.
2. A versioned request/response/error contract and strict validation rules for IDs and totals.
3. Centralized error handling, safe logging, request correlation, and database timeout behavior.
4. Pagination/result limits and abuse protection appropriate to expected traffic.
5. Schema ownership, migration ordering for rolling deploys, retention-job ownership, and an audited deletion policy.
6. An enabled restore drill with measured RTO/RPO and backup monitoring.
7. A lockfile, deployment/build definition, health/readiness behavior, graceful shutdown, metrics, and alerts.
8. Focused automated tests covering authorization, validation, database failures, HTTP responses, migration compatibility, and retention/restore failure paths.

## Uncertainty

This assessment is limited to the files present in `/workspace`. No database schema, deployment manifests, CI workflow, authentication middleware, observability configuration, or production environment settings are present to inspect. Some controls may exist outside this repository, but they should be treated as unverified until the platform team supplies evidence and an end-to-end test demonstrates them.

## Verification performed

- `npm test` — passed: 1 test.
- `node --check` on `src/app.js`, `src/orders.js`, and `src/format.js` — passed.
- `npm run build` — unavailable: `package.json` has no `build` script.
- Repository file inventory reviewed, including the service source, test, migration, README, and restore-check script.
