# Orders API - Engineering Assessment

## Scope

**In Scope:**
- Application code: `src/app.js`, `src/orders.js`, `src/format.js`
- Tests: `test/orders.test.js`
- Database: `migrations/0004_orders_retention.sql`
- CI/CD: `.github/workflows/retention.yml`
- Supporting scripts: `scripts/restore-check.sh`

**Out of Scope:**
- Assessment metadata (`.agent-input/` directory)
- Node.js runtime environment configuration
- PostgreSQL database setup and schema beyond migration files

**Depth:** Targeted — all in-scope files read in full; no additional build/lint tools attempted.

---

## Environment

**Language & Runtime:** JavaScript (ES modules), Node.js  
**Framework:** Express.js 4.19.0  
**Database:** PostgreSQL via `pg` 8.11.0  
**Domain:** RESTful API for managing customer orders  
**Build/Test Tools Available:**
- `npm test` — passes (uses Node.js built-in `node:test`)
- `npm start` — available but not run (requires DATABASE_URL)
- `eslint` — not installed
- `npm audit` — requires approval

---

## Tooling Results

### What I Ran

| Command | Result |
|---------|--------|
| `npm test` | ✅ PASSED — 1 test, 1 pass, 0 fail (105.38ms) |
| `eslint` check | ❌ NOT AVAILABLE — not installed in project |
| `npm audit` | ⏸️ REQUIRES APPROVAL — not executed |

### Tools Not Attempted

| Tool | Reason |
|------|--------|
| Type checking | No TypeScript or type-checking tool configured |
| Format check | No formatter configured |
| Build command | No build step defined in package.json |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Reliability | Unhandled errors in async route handlers | `src/app.js:7,12` — Route handlers await database calls without error handling; unhandled promise rejections crash the process or leave it in broken state. | Add try/catch blocks around `await` calls, or add Express error middleware to catch rejected promises. Ensure all error paths send a response. |
| 2 | High | Data Integrity | Backup restore verification disabled | `scripts/restore-check.sh:2-4` — Restore check disabled on 2026-05-02 due to timeout with no remediation plan. Cannot verify backups are restorable. | Re-enable restore check after addressing performance issues. Document blocking issue or implement a faster verification strategy. |
| 3 | High | Data Integrity | Destructive migration runs automatically without rollback safeguard | `migrations/0004_orders_retention.sql:3,5` + ``.github/workflows/retention.yml:16` — Daily automated deletion and column drop with no transaction safeguard or rollback procedure. | Add transaction wrapping, pre-deletion backup step, or require manual approval for destructive operations. Document rollback procedures. |
| 4 | Medium | Reliability | Missing input type validation on GET endpoint | `src/app.js:7` — GET /orders accepts `customerId` from query parameters without type validation. Non-integer values accepted and passed to database. | Validate and parse `customerId` as an integer before passing to `listOrders`. Return 400 Bad Request if invalid (consistent with POST validation). |
| 5 | Medium | Reliability | createOrder returns potentially undefined value | `src/orders.js:15` — INSERT returns `rows[0]` without checking if `rows` is empty. If query fails silently, callers receive undefined. | Check `rows.length > 0` before returning; throw or return error if insert did not produce expected row. |
| 6 | Medium | Test Coverage | Insufficient test coverage for core business logic | `test/orders.test.js` — Only `formatMinor` function tested; `listOrders` and `createOrder` endpoints have zero test coverage. Critical data flow untested. | Add integration tests for both endpoints: success paths, error conditions, edge cases (missing fields, invalid types, database errors). |

---

## Unconfirmed Issues

None at this depth. All findings above are confirmed by specific code locations.

---

## Summary

### Strengths

1. **Parameterized Query Usage** — `src/orders.js:6,12` correctly use parameterized queries (`$1`, `$2`), providing robust defense against SQL injection despite input validation gaps.

2. **Clear Validation at POST Boundary** — `src/app.js:9-11` explicitly validates required fields and type on POST /orders, establishing an input validation pattern (though inconsistently applied).

3. **Modular Code Structure** — Separation of concerns between app setup (app.js), business logic (orders.js), and formatting (format.js) is clean and maintainable.

### Key Risks

1. **Reliability cascade** — Findings #1, #4, and #5 combine: missing error handling + incomplete input validation + unguarded return values create multiple failure paths where the API crashes or returns invalid data. Findings #1 and #4 should be addressed together.

2. **Data loss risk** — Findings #2 and #3: The backup restore check is disabled, making it impossible to verify the safety of the destructive nightly deletion job. If deletion succeeds but restore fails, data is permanently lost.

### Priority Order

1. **Fix error handling in route handlers** (Finding #1) — Add try/catch or error middleware. This is the foundation; other issues compound it.
2. **Re-enable and fix backup restore verification** (Finding #2) — Unlock the ability to safely run retention. Quick win for data safety confidence.
3. **Add safeguards to destructive migration** (Finding #3) — Wrap in transaction, add pre-deletion backup, or require manual approval.
4. **Validate customerId on GET endpoint** (Finding #4) — Quick fix, brings consistency with POST validation.
5. **Check INSERT return value** (Finding #5) — Low effort, prevents potential undefined returns.
6. **Add integration tests for orders endpoints** (Finding #6) — Moderate effort; essential for preventing regressions on critical data paths.

### Coverage Gaps

- **No integration tests** — Confirmed that `npm test` only runs unit test for `formatMinor`. No tests for HTTP endpoints or database interactions.
- **No load/performance testing** — restore-check.sh was disabled due to timeout; no evidence of performance requirements or testing.
- **No database schema inspection** — Migration file only shown; parent schema, indexes, constraints, and foreign keys not examined (would require database access).
- **No production monitoring setup** — No observability config found; error rates, latency, and failure modes in production unknown.
- **No error middleware or logging** — No structured logging or error tracking system observed in code.
- **No authentication/authorization** — Endpoints have no auth layer; assumes network security is upstream. Not examined for need or implementation.

---

## What I Verified

✅ Tests run successfully (1 pass)  
✅ Package.json and dependencies are well-formed  
✅ All in-scope source files examined for correctness, reliability, error handling, and test coverage  
✅ SQL migration syntax correct and parameterized queries verified safe from injection  
✅ Route handler validation patterns identified and gaps noted  
✅ Backup/restore workflow reviewed for safeguards  
