# Wallet Ledger Engineering Assessment

## Scope

**In scope**: Core ledger functionality in `src/ledger.js` and `src/db.js`, database query patterns, and test coverage in `test/ledger.test.js`.

**Out of scope**: Database schema validation, deployment infrastructure, authentication/authorization layer, production metrics, backup/recovery procedures, PostgreSQL configuration tuning.

**Depth**: Targeted — all in-scope source files read in full; available automated checks run.

---

## Environment

**Language**: JavaScript (Node.js, ES modules)

**Runtime**: Node.js with native `node:test` framework

**Database**: PostgreSQL (pg driver ^8.11.0)

**Domain**: Financial transaction ledger for multi-account wallet system

**Key requirement** (from README): "The ledger is the source of truth for reconciliation: the sum of entries must always equal the difference between the account balances."

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | ✔ Pass — 1 test passed, 0 failed, 93.5ms |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Data Integrity | Race condition enables overdraft and double-spending | `src/ledger.js:9-12` — balance read at line 9, checked at line 10, then updated at line 12. Concurrent transfers bypass the check. Between READ and UPDATE, another thread can transfer the same funds. | Wrap the balance check and both account updates in a single transaction. Use `SELECT ... FOR UPDATE` to lock the row, or issue all three operations in a transaction block (`BEGIN`/`COMMIT`). |
| 2 | **Critical** | Data Integrity | Missing transaction causes ledger-to-balance mismatch | `src/ledger.js:12-17` — Two UPDATE queries and one INSERT are executed separately without `BEGIN`/`COMMIT`. If the INSERT fails after both UPDATEs succeed, ledger entries won't reflect the balance change, violating the reconciliation invariant. | Wrap lines 12-17 in a single transaction. Ensure atomicity: either all three queries succeed or none do. Use explicit transaction control with `pool.connect()` or a transaction library. |
| 3 | **Critical** | Reliability | Unhandled database errors leave system in inconsistent state | `src/ledger.js:12-17` — No error handling on any query. If UPDATE/INSERT fails mid-operation, transfers are partially applied. Exception propagates, halting the function but leaving the database in an inconsistent state. | Add try/catch around the transfer logic. On error, either ensure a rollback is automatic (via transaction) or explicitly roll back any partial changes. Return detailed error to caller. |
| 4 | **High** | Correctness | Insufficient validation of input parameters | `src/ledger.js:8` — `amountMinor`, `fromId`, `toId` are not validated. Negative amounts, null IDs, or same-account transfers (fromId == toId) are not checked and could cause silent logic errors. | Validate inputs at the function entry: check that `amountMinor > 0`, `fromId` and `toId` are non-null and differ, and account IDs match expected format. |
| 5 | **High** | Reliability | Minimal test coverage hides critical failures | `test/ledger.test.js:5-8` — Test only verifies that the string "insufficient funds" appears in source code; it does not execute the transfer logic or test concurrency scenarios. No tests for: transaction atomicity, ledger-balance reconciliation, concurrent transfers, error handling. | Add integration tests: concurrent transfer scenarios, ledger sum validation, error recovery, account state consistency after failures. Use database fixtures or in-memory test database. |

---

## Unconfirmed Issues

None. All findings above are confirmed by direct code inspection and the stated system requirement.

---

## Summary

### Strengths

- **Clear API surface**: The `balanceMinor()` and `transfer()` functions have straightforward interfaces.
- **Appropriate use of parameterized queries**: All SQL uses `$1`, `$2`, etc. placeholders, preventing SQL injection.

### Key Risks

The wallet ledger violates its core invariant—that ledger entries must always match account balance changes—due to two critical issues:

1. **Race condition (Finding #1)**: Concurrent transfers can overdraft by exploiting the gap between balance check and update. Example: Account A has $100. Two concurrent transfers for $100 each both read $100, both pass the check, both execute successfully, leaving Account A at -$100 and ledger entries totaling -$100, but the balance should prevent both transfers.

2. **Missing atomicity (Findings #2, #3)**: Three separate database operations (two UPDATEs, one INSERT) without transaction boundaries. If any operation fails, the ledger becomes permanently inconsistent. A finance reconciliation will fail nightly because sum(ledger_entries) ≠ (final_balance - initial_balance).

These are release blockers for a financial system. The current code is unsafe for production use even at low transfer volumes.

### Priority Order

1. **Implement transaction-based transfers** (Finding #2) — wrap lines 12–17 in an explicit BEGIN/COMMIT transaction. This fixes atomicity and enables using SELECT...FOR UPDATE for the race condition. High effort, critical impact.

2. **Add row-level locking** (Finding #1) — within the transaction, add `SELECT balance_minor FROM accounts WHERE id = $1 FOR UPDATE` before the balance check. Medium effort, critical impact.

3. **Add comprehensive error handling** (Finding #3) — wrap transfer logic in try/catch, ensure rollback on failure, return detailed errors. Low-to-medium effort.

4. **Validate input parameters** (Finding #4) — check amountMinor > 0, fromId != toId, IDs are non-null. Low effort, prevents edge-case bugs.

5. **Add integration tests** (Finding #5) — tests for concurrent transfers, ledger reconciliation, error scenarios. Medium effort. Current test does not validate actual behavior.

### Coverage Gaps

- **Deployment and operational testing**: No information on production traffic patterns, peak volume, or whether this code has been load-tested.
- **Database schema**: Schema definition not provided; cannot verify constraints, indexes, or migration safety.
- **Concurrency testing**: No load test or stress test to confirm race condition manifests or to validate fixes.
- **Ledger audit tooling**: No verification that nightly reconciliation logic or audit queries exist in the larger system.
- **Error recovery procedures**: No documented recovery or manual reconciliation process if ledger corruption occurs.
- **Connection pool exhaustion scenarios**: Pool error handling not examined; unclear what happens if `pool.query()` fails.

