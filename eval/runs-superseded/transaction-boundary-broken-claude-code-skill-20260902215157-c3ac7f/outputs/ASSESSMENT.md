# Wallet Ledger Assessment

## Scope

**In scope**:
- `src/ledger.js` — core transfer and balance functions
- `src/db.js` — database layer and connection management
- `test/ledger.test.js` — test suite
- `package.json` — dependencies and build configuration

**Out of scope**:
- Production deployment configuration
- Database schema and migration files (not provided)
- Account creation/deletion logic (not in scope)
- Authentication and authorization (not examined)

**Depth**: Targeted — all in-scope files examined in full; code reading performed for correctness, reliability, data integrity, and concurrency concerns.

---

## Environment

**Language & Runtime**: JavaScript (Node.js, ES modules)

**Database**: PostgreSQL (pg 8.11.0)

**Domain**: Financial transaction ledger system

**Platform Target**: Server-side financial processing

**Build & Test Tooling**: Node.js built-in test runner

---

## Tooling Results

### What I ran

**Attempted**: `node --test test/ledger.test.js`  
**Status**: Command requires execution approval; not run in this session.  
**Impact**: Test output unavailable, but test code itself was examined.

### Tools not run

| Tool       | Reason                                    |
| ---------- | ----------------------------------------- |
| npm test   | Execution approval required               |
| npm audit  | Dependencies not installed (offline env) |
| Node build | No build step defined                     |

### Observations from code inspection

The single test in `test/ledger.test.js` (lines 1–8) does not execute any transfer logic. It only reads the source file and asserts that the string "insufficient funds" exists in the code. This test catches code deletion but not functional correctness.

---

## Findings Table

| # | Severity | Area           | Finding                                                     | Evidence                                              | Recommendation                                                                                                    |
|---|----------|----------------|-------------------------------------------------------------|-------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| 1 | Critical | Data Integrity | Race condition: balance check not atomic with update       | `src/ledger.js:9–10` reads balance; lines 12–13 update separately without transaction. Another process can modify balance between check and update, causing overdraft or data loss. | Wrap all three operations (lines 12–16) in a database transaction. Use BEGIN/COMMIT or prepared statements with isolation level SERIALIZABLE. |
| 2 | Critical | Reliability    | Partial transaction failure leaves ledger inconsistent      | `src/ledger.js:12–16` performs three separate operations without rollback. If INSERT (line 14–16) fails after UPDATEs succeed, accounts are decremented/incremented but ledger entry is never created. | Wrap all operations in a single transaction. If any fails, roll back all. Catch errors and throw to prevent silent corruption. |
| 3 | Critical | Data Integrity | Ledger entries may never be created if queries fail         | `src/ledger.js:12–16` — no error handling. If line 14–16 (INSERT) fails, balance is already modified but ledger_entries has no record. Finance nightly reconciliation will detect mismatch but not the root cause. | Add error handling around the entire transaction. Roll back all changes if any single operation fails. Return error details to caller. |
| 4 | High     | Reliability    | No error handling on database queries                       | `src/ledger.js` — all three query calls (lines 12–16) lack `.catch()` or try/catch. Unhandled promise rejections will crash or leave process in broken state. | Wrap all database operations in try/catch. Return specific error details: which account, which operation failed, what exception occurred. |
| 5 | High     | Correctness    | Test coverage inadequate for financial criticality         | `test/ledger.test.js:5–8` — only checks if string exists in source; does not execute transfer. No tests for: balance correctly decremented/incremented, ledger entries created, concurrent transfers, insufficient funds rejection, edge cases (zero amount, same account, negative amount). | Add functional tests: (a) successful transfer decrements from and increments to; (b) ledger entry is created; (c) insufficient funds rejection prevents any updates; (d) concurrent transfers maintain consistency; (e) zero or negative amounts handled. |
| 6 | Medium   | Reliability    | Database pool never closed on shutdown                      | `src/db.js:3` — pool created but never closed. On process shutdown (graceful or crash), connections remain open, blocking clean exit. | Add pool.end() on process.on('SIGTERM') and process.on('SIGINT'). Or wrap pool in a module with explicit shutdown method. |
| 7 | Medium   | Maintainability | Missing input validation on function parameters            | `src/ledger.js:8` — accountIds and amountMinor not validated. No checks for: null, undefined, non-numeric, negative, zero. Silent behavior on bad input. | Add validation: assert accountIds are non-empty strings or numbers; amountMinor is positive integer. Throw descriptive error on failure. |
| 8 | Low      | Maintainability | Implicit assumption: balanceMinor always non-null           | `src/ledger.js:5` — nullish coalescing returns 0 for missing account, but transfer (line 9) assumes account exists. No distinction between "account has zero balance" and "account not found". | Document assumption or explicitly query account existence first. Consider separate error for "account not found" vs. "insufficient funds". |

---

## Unconfirmed Issues

**Race condition under concurrent load** (suspected but cannot confirm without production database and load testing):
- If multiple transfers target the same account concurrently, the initial balance read may be stale by the time UPDATEs execute. PostgreSQL's default READ COMMITTED isolation level does not prevent this. Evidence: standard race-condition analysis of non-atomic read-check-update pattern. Would require integration test with concurrent connections to confirm impact on real schema.

---

## Summary

### Strengths

1. **Clear API surface**: The `balanceMinor()` and `transfer()` functions expose a simple, understandable interface. No unnecessary abstraction layers.

2. **Parameterized queries**: All database queries use parameter binding (`$1`, `$2`, etc.) from the outset, preventing SQL injection. Evidence: `src/db.js:6` and all calls in `src/ledger.js`.

### Key Risks

The transfer function has **three critical defects that must be fixed before production traffic increases**:

1. **Finding #1 (Race condition)**: Balance check and account updates are not atomic. Concurrent transfers can cause overdrafts.

2. **Finding #2 (Partial failure)**: Operations lack transaction boundaries. If INSERT fails, ledger entries are skipped while accounts are modified, causing reconciliation failures.

3. **Finding #3 (Ledger inconsistency)**: No recovery mechanism. When failures occur, the financial ledger and account balances diverge with no automatic rollback.

Related findings (#4, #6, #7, #8) compound these risks: lack of error handling makes partial failures silent; missing tests mean failures are only discovered in production during nightly reconciliation.

### Priority Order

1. **Wrap transfer operations in a database transaction** (Finding #1, #2, #3)
   - Use `BEGIN ... COMMIT` or `client.query('BEGIN')` → operations → `COMMIT` / `ROLLBACK`.
   - Set isolation level to SERIALIZABLE or REPEATABLE READ to prevent concurrent read-check-update races.
   - **Effort**: Low (1–2 hours). **Impact**: Blocks data corruption under concurrent load.

2. **Add try/catch error handling around all database operations** (Finding #4)
   - Catch errors on each query and rollback the transaction.
   - Return error to caller instead of throwing uncaught promise rejection.
   - **Effort**: Low (30 minutes). **Impact**: Prevents silent crashes.

3. **Add functional tests for transfer logic** (Finding #5)
   - Test successful transfer: verify from_id decremented, to_id incremented, ledger entry created.
   - Test insufficient funds: verify no updates occur.
   - Test error cases (null accounts, zero amount, concurrent transfers).
   - **Effort**: Medium (2–3 hours). **Impact**: Prevents regressions; catches bugs before production.

4. **Add input validation** (Finding #7)
   - Validate accountIds and amountMinor; throw on invalid input.
   - **Effort**: Low (30 minutes). **Impact**: Improves robustness.

5. **Add pool shutdown handling** (Finding #6)
   - Call `pool.end()` on graceful shutdown signals.
   - **Effort**: Low (15 minutes). **Impact**: Improves deployment reliability.

### Coverage Gaps

**Not examined** (unavailable in this workspace):

- **Database schema**: Not provided. Findings assume standard account/ledger_entries structure; actual schema may have constraints or triggers that change risk assessment.
- **Production database state**: No access to real data volume, connection counts, or current query performance.
- **Deployment and monitoring**: No alerting or reconciliation job examined; cannot assess whether nightly reconciliation catches inconsistencies reliably.
- **Load testing**: No stress tests run; concurrent behavior inferred from code logic, not measured.
- **Integration tests**: Only code inspection performed; no live database connection tested.
- **Authentication/Authorization**: Not examined; assumed to be handled by application layer above transfer().

---

## Verified

✓ Scope established and all in-scope files examined  
✓ Parameterized query usage confirmed (no SQL injection risk at query layer)  
✓ Core transfer logic flow analyzed for race conditions and atomicity  
✓ Test coverage identified as inadequate for financial system  
✓ Database connection lifecycle reviewed
