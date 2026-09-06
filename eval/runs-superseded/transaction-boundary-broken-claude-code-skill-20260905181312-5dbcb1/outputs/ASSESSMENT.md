# Wallet Ledger Engineering Assessment

## Scope

**In scope:**
- `src/ledger.js` — core transfer logic
- `src/db.js` — database connection and query execution
- `test/ledger.test.js` — test coverage
- `package.json` — dependencies and scripts
- `README.md` — requirements and architectural understanding

**Out of scope:**
- Database schema definition (assumed to exist based on queries)
- Production deployment configuration
- Database performance tuning
- Nightly reconciliation process
- Customer-facing API layer (if any)

**Depth:** Targeted — all in-scope files read in full; project is small.

---

## Environment

**Language and runtime:** JavaScript (Node.js), type: "module"

**Framework and libraries:** 
- `pg` ^8.11.0 — PostgreSQL client for database access

**Domain:** Financial transaction ledger for wallet accounts

**Platform targets:** Server-side; database-backed service

**Build/test tooling:** Node.js native test runner (`node --test`)

---

## Tooling Results

### What I Ran

| Command | Result |
|---------|--------|
| `npm test` | ✔ Pass: 1 test passed in 102ms |
| `npm run` | ✔ Shows available scripts (only `test` defined) |

### Tools Not Attempted

| Tool | Reason |
|------|--------|
| `npm audit` | Dependency audit not run (requires approval); package-lock.json not present to assess lockfile staleness |
| `eslint` | Not configured for this project |
| `tsc --noEmit` | Project is untyped JavaScript |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Data Integrity | No transaction wrapping transfer operations | `src/ledger.js:8-20` — three separate `query()` calls (UPDATE, UPDATE, INSERT) without transaction control. If any operation fails mid-transfer, ledger and balance state diverge. | Wrap all three operations in a single PostgreSQL transaction using `BEGIN`, `COMMIT`, `ROLLBACK` or use a transaction helper that handles atomicity. |
| 2 | Critical | Correctness | Race condition: balance checked before update, not under lock | `src/ledger.js:9-10` — `balanceMinor()` reads balance, then `UPDATE` proceeds separately. Between check and update, another concurrent transfer can execute, causing overspend. | Move balance check into the UPDATE statement: `UPDATE ... WHERE balance_minor >= $1` and verify row count, or use explicit row-level locking (`SELECT ... FOR UPDATE`) within a transaction. |
| 3 | Critical | Reliability | No error handling; query failures unhandled | `src/ledger.js:8-20` — no try/catch on any query. If UPDATE or INSERT fails (connection lost, constraint violation, etc.), function throws unhandled rejection; caller has no way to distinguish partial success from full failure. | Wrap transfer logic in try/catch; on error, explicitly roll back or ensure idempotency; return error details to caller so they know what failed. |
| 4 | High | Correctness | Missing input validation | `src/ledger.js:8` — no checks for negative amounts, self-transfers (fromId === toId), or null/undefined IDs. Negative amount could reverse direction of transfer; self-transfer wastes database writes. | Add validation: `if (!amountMinor || amountMinor <= 0) return { ok: false, reason: 'invalid amount' }; if (fromId === toId) return { ok: false, reason: 'cannot transfer to self' };` |
| 5 | High | Maintainability | Test suite does not verify actual behavior | `test/ledger.test.js:5-8` — test only checks that string "insufficient funds" exists in source code, does not test actual transfer logic, balance updates, or ledger insertion. | Add integration tests: test successful transfer (verify both balance changes and ledger entry created), test insufficient funds scenario, test concurrent transfers, test error handling. |
| 6 | Medium | Reliability | balanceMinor returns 0 for missing account silently | `src/ledger.js:5` — `rows[0]?.balance_minor ?? 0` returns 0 if account doesn't exist. Subsequent transfer proceeds without error. Account not found should be detected and rejected. | Query should explicitly check if account exists or return an error on zero rows: `if (rows.length === 0) return 0; // or throw?` Consider whether missing account should be an error state. |
| 7 | Medium | Architecture | Hardcoded DATABASE_URL in pool initialization, no connection validation | `src/db.js:3` — Pool created with `process.env.DATABASE_URL` but no check that it exists or is valid. If DATABASE_URL is missing or malformed, errors will surface only on first query. | Add startup check: validate DATABASE_URL is set and attempt a test connection before application starts serving requests. |

---

## Unconfirmed Issues

**Potential idempotency risk on ledger insertion:**
- If the INSERT into `ledger_entries` succeeds but response is lost (network failure after INSERT but before client receives success), retry logic would create duplicate ledger entries. This is suspected but not confirmed without knowing the retry strategy of the calling code. If transfers are retried client-side on timeout, this is a High/Critical issue.

**Missing uniqueness constraint on ledger entries:**
- Without evidence of a unique constraint or deduplication key on ledger_entries, duplicate rows are possible. Requires inspection of database schema.

---

## Summary

### Strengths

1. **Parameterized queries prevent SQL injection** — all queries use `$1`, `$2` parameter placeholders, protecting against injection attacks (`src/ledger.js` and `src/db.js`).
2. **Clean module structure** — separation of database layer (`db.js`) from business logic (`ledger.js`) is appropriate and makes testing easier.

### Key Risks

**Findings #1, #2, #3 must be addressed before any increase in transfer volume.** These are showstoppers for a financial ledger:

- **Finding #1 (No transactions)**: A power failure, connection drop, or deployment during a transfer can leave balances and ledger out of sync. Reconciliation will detect it, but customer impact is already done.
- **Finding #2 (Race condition on balance check)**: As transfer volume increases, the window for concurrent conflicts grows. At even modest QPS, overdrafts are virtually certain.
- **Finding #3 (No error handling)**: Unhandled rejections will crash the service or hang. Callers cannot retry safely or know why a transfer failed.

**Finding #5** (test suite gap) means we have no confidence that the balance-checking logic works as intended.

### Priority Order

1. **Fix Finding #1 (transactions)** — adds atomicity to all three operations; enables rollback on any failure. Prerequisite for reliability.
2. **Fix Finding #2 (race condition via locking)** — move balance check into the WHERE clause or use `SELECT ... FOR UPDATE`. Prerequisite for correctness under concurrency.
3. **Fix Finding #3 (error handling)** — wrap in try/catch; ensure all failure paths are handled. Prerequisite for observability and safe retries.
4. **Fix Finding #4 (input validation)** — quick win; prevents obvious misuse (negative amounts, self-transfers).
5. **Fix Finding #6 (missing account handling)** — decide whether missing account is an error or a warning; add explicit check.
6. **Add Finding #5 (real tests)** — write integration tests for transfer success/failure paths, concurrent scenarios, and error recovery.
7. **Fix Finding #7 (connection validation)** — add startup check for DATABASE_URL and test connection.

### Coverage Gaps

**Not examined:**
- Database schema (column types, constraints, indexes) — assumed but not validated.
- Deployment and runtime environment — no inspection of how pool is configured, connection limits, timeout behavior.
- Nightly reconciliation logic — outside scope, but is the detection mechanism for ledger drift.
- Calling code and retry strategies — no access to code that invokes `transfer()`. If retries exist without idempotency keys, duplicate ledger entries are likely.
- Load testing under concurrent transfers — the race condition and transaction issues are invisible until high concurrency.
- Backup and disaster recovery strategy — not examined.

---

## Conclusion

**The wallet ledger is not ready for volume increase.** The lack of transaction atomicity and the race condition on balance checking create a direct path to ledger inconsistency. The absence of error handling means failures are undetectable to callers. Before any production increase in transfer throughput, Findings #1–#3 must be resolved.
