# Engineering Assessment: Wallet Ledger

## Scope

**In scope:**
- Core transfer logic: `src/ledger.js`
- Database abstraction: `src/db.js`
- Test suite: `test/ledger.test.js`
- Configuration: `package.json`
- Project documentation: `README.md`

**Out of scope:**
- Evaluation cases and test fixtures beyond what is in the main test file
- Production deployment configuration and monitoring
- Graders or expected answer outputs
- External services or infrastructure beyond the PostgreSQL client

**Depth:** Targeted — every file in scope was read in full; available automated checks were run.

---

## Environment

**Language & Runtime:** Node.js (ES modules) with JavaScript

**Framework & Libraries:**
- `pg` (^8.11.0) — PostgreSQL client library

**Domain:** Financial transaction processing — wallet-to-wallet transfers with ledger reconciliation

**Platform Target:** Server-side application (Node.js runtime)

**Build & Tooling:** npm; no build step defined; tests via `node --test`

---

## What I Ran

### Commands Executed

| Command | Result |
|---------|--------|
| `npm test` | ✓ PASS — 1 test passed in 92.73ms. Test verifies string `"insufficient funds"` is present in source code. |

### Tools Unavailable

| Tool | Reason |
|------|--------|
| `npm audit` | Not attempted (would require npm to fetch registry; no vulnerabilities auditable locally) |
| Type check (tsc/TypeScript) | Not applicable — project is JavaScript, no type checking configured |
| Linter (eslint) | Not configured in `package.json` or `.eslintrc` files |
| Format check (prettier) | Not configured |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | Unprotected race condition in concurrent transfers | `src/ledger.js:8-19` — `balanceMinor()` check at line 9 is unsynchronized; two concurrent requests can both read the same balance, pass the check, and overdraw the account. No transaction scope protects the check-then-update sequence. | Wrap the entire transfer operation (balance check, both account updates, and ledger entry insert) in a single PostgreSQL transaction. Use `BEGIN`, `COMMIT`, `ROLLBACK` or pg client's transaction API. |
| 2 | Critical | Data Integrity | Inconsistent ledger-to-balance reconciliation on partial failure | `src/ledger.js:12-17` — Account balance updates (lines 12–13) are committed before the ledger entry insert (lines 14–17). If the INSERT fails, the accounts reflect the transfer but the ledger does not, breaking the reconciliation invariant stated in `README.md`: *"the sum of entries must always equal the difference between the account balances."* | Include all three mutations (both balance updates + ledger insert) in a single transaction. Ensure atomicity: either all succeed or all roll back. |
| 3 | High | Reliability | Unhandled query errors leave system in undefined state | `src/ledger.js:12-17` — No `.catch()` or error handling on any `query()` call. If a query fails (network, syntax, constraint violation), the `transfer()` function throws uncaught, and any partial state remains uncommitted or committed depending on which query failed. Callers have no way to know whether funds were transferred. | Add transaction-scoped error handling: wrap all queries in a try-catch, catch errors, rollback the transaction, and return a consistent error result to the caller (e.g., `{ ok: false, reason: 'database error', ...}`). |
| 4 | High | Reliability | Silent database connection failure at startup | `src/db.js:3-4` — Pool is created but connection errors are not handled or logged. If `DATABASE_URL` is missing or invalid, the pool construction fails silently, and the first query will throw an unhandled error. No retry logic or graceful degradation. | Test that `DATABASE_URL` is set at module load time; emit a clear error and exit if not. Optionally add connection retry logic with exponential backoff, or document that connection pooling is required to be pre-validated. |
| 5 | Medium | Testing | Test suite only validates code presence, not behavior | `test/ledger.test.js:5-8` — The single test verifies that the string `"insufficient funds"` exists in the source code (`src.includes()`) but does not call `transfer()`, provide a database, or verify the function behaves correctly. A refactoring that removes or renames the string will fail the test; actual functionality is unchecked. | Write integration tests that: (1) set up a test database, (2) insert test accounts, (3) call `transfer()` with various scenarios (sufficient funds, insufficient funds, zero amount, same-account transfer), and (4) verify both account balances and ledger entries are correct. At minimum, test the insufficient-funds path with actual database state. |

---

## Unconfirmed Issues

### Potential Issues Requiring Investigation

1. **Foreign key constraints not confirmed:** The `README.md` assumes `from_id` and `to_id` exist in `accounts`, and `accounts` has a `balance_minor` column. However, no schema is provided. If the table structure differs, queries may fail silently or succeed with unexpected results.
   - **What would confirm it:** Access to the database schema (e.g., `\d accounts` in psql) or a migration/schema file.

2. **No explicit connection pooling limits:** `src/db.js:3` creates a Pool with no explicit configuration. Default behavior may not be appropriate under high transfer volume.
   - **What would confirm it:** Connection pool configuration details and expected transaction throughput under load.

3. **Missing amount validation:** `transfer()` does not check that `amountMinor` is positive or non-zero. Negative or zero transfers might succeed in the database (depending on constraints).
   - **What would confirm it:** Running `transfer(id1, id2, 0)` or `transfer(id1, id2, -100)` against a live database.

---

## Summary

### Strengths

- **Clear API contract:** The `transfer()` function has a simple, understandable signature and return type (`{ ok: boolean, reason?: string }`), making it easy to integrate.
- **Modular database abstraction:** The `db.js` module isolates pool creation and query execution, allowing centralized connection management.
- **Consistent dependency pinning:** The `package.json` pins the PostgreSQL driver version (`^8.11.0`), reducing surprise breakage from minor updates.

### Key Risks

**Critical severity issues (must fix before increasing transfer volume):**

1. **Finding #1 (Race condition):** Concurrent transfers from the same account can overdraw the account. This is the direct blocker to any production use at scale.
2. **Finding #2 (Ledger-balance inconsistency):** Partial failures corrupt the reconciliation invariant. Finance reconciliation will detect mismatches, and recovery will be manual and error-prone.

**High severity issues (should fix soon):**

3. **Finding #3 (Unhandled errors):** Silent failures leave the system in an undefined state, making debugging and incident response extremely difficult.
4. **Finding #4 (Connection failure):** Startup errors are not obvious, risking deployments that silently fail to initialize.

### Priority Order

1. **Wrap transfer in a PostgreSQL transaction** (Findings #1 and #2) — This is the foundational fix that prevents race conditions and data corruption. Include all mutations (both balance updates + ledger insert) and proper rollback on error. Estimated effort: 1–2 hours.
2. **Add error handling and rollback logic** (Finding #3) — Add try-catch around all queries, rollback on error, return consistent error responses. Estimated effort: 1 hour.
3. **Validate DATABASE_URL at startup** (Finding #4) — Add a simple check and exit if the connection string is missing. Estimated effort: 30 minutes.
4. **Implement integration tests** (Finding #5) — Test actual database behavior with sufficient/insufficient funds scenarios. This will catch regressions and validate fixes #1–#3. Estimated effort: 2–3 hours.
5. **Add input validation** (Unconfirmed) — Verify that `amountMinor > 0` before proceeding. Estimated effort: 30 minutes.

### Coverage Gaps

**Code areas not examined:**
- Production database schema (migrations, constraints, indexes) — assumed but not verified.
- Deployment configuration and monitoring setup — out of scope.
- Caller error handling — callers of `transfer()` are not in scope.

**Testing not performed:**
- Load testing or concurrency stress tests (would have surfaced the race condition immediately).
- Failure mode testing (network errors, constraint violations, connection pool exhaustion).
- Schema validation (do the queried columns and tables actually exist?).

**Information unavailable:**
- Expected transaction throughput and concurrency level under normal operation.
- SLA or RTO/RPO requirements for the ledger system.
- Existing monitoring, alerting, or reconciliation processes.

**Tools that could not run:**
- Type checking (no TypeScript configuration).
- Linting (no eslint configuration).
- Vulnerability audit (npm audit would require external registry access).

---

**Assessment completed:** 2026-09-05

**Recommendation:** Do not increase transfer volume until Findings #1 and #2 are resolved and retested. Consider a phased rollout test (small volume, high concurrency monitoring) after all Critical and High findings are fixed.
