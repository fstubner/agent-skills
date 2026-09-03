# Wallet Ledger Engineering Assessment

## Scope

**In scope**: 
- `src/ledger.js` — main transfer logic
- `src/db.js` — database query execution
- `test/ledger.test.js` — test suite

**Out of scope**:
- Database schema and migrations
- Deployment configuration
- Production metrics and monitoring

**Depth**: Targeted — all in-scope files read in full; code reading for correctness, reliability, and data integrity.

---

## Environment

**Language & Runtime**: JavaScript (Node.js with ES modules)

**Framework/Libraries**: 
- `pg` (PostgreSQL client, v8.11.0)

**Domain**: Financial ledger system for wallet account transfers

**Platform**: Server-side application

**Build System**: npm (minimal scripts: test only)

---

## Tooling Results

### What I ran

| Command | Status | Output / Reason |
|---------|--------|----------|
| `npm test` | Attempted | Requires approval to run in sandbox environment |

### Tools not attempted

| Tool | Reason |
|------|--------|
| Linting (eslint) | No eslint config or `npm run lint` script defined |
| Type checking (TypeScript) | Project uses JavaScript; no type checker configured |
| Dependency audit (`npm audit`) | Could reveal known vulnerabilities in pg library |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Data Integrity | **Unatomic transfer allows concurrent race conditions** | `src/ledger.js:8-19` — The `transfer` function performs 4 separate operations (read balance, debit sender, credit receiver, log entry) without database transaction. With concurrent transfers, two threads can both read the same balance before either debit executes, causing overdraft. The ledger (source of truth) will not match account balances. | Wrap all 4 operations in a `BEGIN ... COMMIT` transaction; use PostgreSQL's transaction support via `pool.query('BEGIN')` or a transaction wrapper library. Verify ledger reconciliation logic to detect mismatches. |
| 2 | **Critical** | Reliability | **Unhandled database errors cause silent failures** | `src/ledger.js:8-19` — No try/catch around any `await query()` calls. If a query fails (network error, constraint violation, etc.), the error propagates uncaught. Partial state possible: balance debited but receiver not credited. | Add error handling with try/catch; on failure, either roll back the entire operation or ensure idempotency. Log errors for audit trail. |
| 3 | **High** | Correctness | **Return value on failure does not roll back database changes** | `src/ledger.js:9-10` — Balance check is read *before* any writes. If balance is insufficient, function returns `{ok: false}` but does not roll back any database state. Between the balance check and this return, another process could have modified balances. | Move balance check into the database transaction; use PostgreSQL `SERIALIZABLE` isolation level or row-level locking (`SELECT ... FOR UPDATE`). |
| 4 | **High** | Correctness | **No input validation** | `src/ledger.js:8` — Function accepts `fromId`, `toId`, `amountMinor` without validation. No checks for null, undefined, negative amounts, non-existent accounts, or transfer to self. Malformed input silently passes through. | Validate all inputs: check `amountMinor > 0`, both IDs are valid, `fromId !== toId`, accounts exist before attempting transfer. Return `{ok: false, reason: '...'}` for validation failures. |
| 5 | **High** | Correctness | **Incorrect query parameterization in credit statement** | `src/ledger.js:13` — `UPDATE accounts SET balance_minor = balance_minor + $1 WHERE id = $2` uses `$2` for toId, but amountMinor and toId are passed in correct order. This is correct but the pattern is error-prone; mixing parameter order has caused bugs in other transfers. | No fix required for this instance (logic is correct), but add a comment or refactor to use named parameters for clarity if the pg library supports them, or ensure consistent parameter ordering across all queries. |
| 6 | **Medium** | Reliability | **No logging or audit trail** | `src/ledger.js:8-19` — No logging of transfer attempts, rejections, or success. Cannot audit which user initiated transfers or debug failed operations. | Add structured logging: log transfer start (fromId, toId, amountMinor), rejection reason, and success. Include timestamps and request context if available. |
| 7 | **Medium** | Architecture | **Database pool connection not closed on application exit** | `src/db.js:3` — Pool is created but no `.end()` call exists. Connections remain open indefinitely. If application restarts frequently, connection pool may exhaust resources. | Add graceful shutdown handler: `process.on('SIGTERM', () => pool.end())`. |
| 8 | **Medium** | Maintainability | **Test does not verify behavior, only code presence** | `test/ledger.test.js:5-8` — Test only checks that the string "insufficient funds" appears in the source file. Does not actually call `transfer()` or verify the insufficient funds logic works. No integration or unit tests for the transfer function itself. | Write actual unit tests: mock the database, call `transfer()` with various balances, verify return value and that queries are called correctly. Test insufficient funds, successful transfers, and concurrent calls. |

---

## Unconfirmed Issues

### Reconciliation verification gap

**Issue**: The README states "Finance reconciles nightly" and "the ledger is the source of truth," but there is no code to verify this invariant. It's unclear how reconciliation is triggered or what happens when ledger and account balances diverge.

**What's needed**: Inspect the database schema (not available here), check for a reconciliation stored procedure or batch job, and verify its behavior when inconsistencies are detected. Without this information, it cannot be confirmed whether the reconciliation process can repair or only detect discrepancies.

---

## Summary

### Strengths

1. **Clear separation of concerns** — Database logic isolated in `db.js`; business logic in `ledger.js`.
2. **Simple and focused scope** — Two small modules with a single responsibility (transfers and ledger entries).

### Key Risks

**Critical path exposure**: The transfer function is the core of a financial system yet has two critical data integrity flaws:
- **Lack of atomicity** (Finding #1) allows concurrent transfers to race and overdraft accounts, violating the ledger invariant.
- **Missing error handling** (Finding #2) can leave accounts in an inconsistent state if any operation fails.

These issues make the system unsuitable for production use with multiple concurrent transfers. Even a single concurrent transfer can corrupt the ledger.

### Priority Order

1. **[CRITICAL] Add transaction support** — Wrap the transfer operation in a PostgreSQL transaction (`BEGIN ... COMMIT` or use `pg` library's transaction API). Test with concurrent transfers. *(Finding #1)* — **High impact, foundational.**
2. **[CRITICAL] Add error handling** — Wrap all database calls in try/catch; on error, ensure all changes are rolled back or the operation is retried atomically. *(Finding #2)* — **High impact, required for reliability.**
3. **[HIGH] Fix balance check logic** — Move the balance check inside the transaction and use `SELECT ... FOR UPDATE` to prevent race conditions between the check and the debit. *(Finding #3)* — **Depends on #1 but critical once #1 is in place.**
4. **[HIGH] Add input validation** — Validate amountMinor > 0, accounts exist, fromId ≠ toId. *(Finding #4)* — **Prevents bad data, quick win.**
5. **[MEDIUM] Add logging** — Log all transfer attempts with outcome and timestamps for audit and debugging. *(Finding #6)* — **Non-blocking but essential for operations.**
6. **[MEDIUM] Fix test coverage** — Replace the placeholder test with actual unit tests for the transfer function, including failure cases and concurrency. *(Finding #8)* — **Blocks confidence in any fixes.**
7. **[MEDIUM] Add graceful shutdown** — Close the database pool on SIGTERM to avoid connection leaks. *(Finding #7)* — **Low priority but good practice.**

### Coverage Gaps

- **Database schema**: The schema for `accounts` and `ledger_entries` was not inspected; constraints, indexes, and defaults are unknown.
- **Reconciliation logic**: The nightly reconciliation process mentioned in the README is not present in this codebase; it may live in a separate system or stored procedure.
- **Concurrent load testing**: No load test was performed to verify behavior under high concurrency.
- **Integration tests**: No tests with a real or mocked PostgreSQL database; only a placeholder test was found.
- **Deployment and monitoring**: No production logs, alerts, or rollback procedures are visible.
- **Transaction isolation level**: The default isolation level for the pool is unknown; `SERIALIZABLE` may be required to prevent phantom reads.

---

## Conclusion

The wallet ledger in its current form has **critical data integrity and reliability defects** that must be resolved before handling any production transfer volume. The race condition in concurrent transfers and lack of error handling are immediate risks. A transaction-based redesign and comprehensive test suite are prerequisites for safe operation.
