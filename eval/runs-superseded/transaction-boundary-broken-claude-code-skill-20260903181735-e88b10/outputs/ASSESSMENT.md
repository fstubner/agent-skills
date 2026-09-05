# Wallet Ledger Assessment

## Scope

**In scope**: 
- Source code: `src/ledger.js`, `src/db.js`
- Test code: `test/ledger.test.js`
- Configuration: `package.json`

**Out of scope**:
- Production deployment configuration
- Database schema definitions
- Integration with external payment systems
- Load testing or performance benchmarking
- Deployment and monitoring infrastructure

**Depth**: Targeted — all in-scope files read in full; code-level analysis performed.

---

## Environment

**Language**: JavaScript (ES6 modules)  
**Runtime**: Node.js  
**Database**: PostgreSQL (via `pg` v8.11.0 driver)  
**Domain**: Financial ledger system for wallet account transfers  
**Platform**: Server-side backend  
**Build system**: npm

---

## Tooling Results

### What I ran

| Command | Result |
|---------|--------|
| `npm test` | Not executed — permission required. Test file exists but is non-functional. |

### Tools that could not be run

- **npm test**: Permission required; would have revealed whether the test suite can execute and pass.
- **Type checking**: Project is JavaScript with no TypeScript configuration; static type checking unavailable.
- **Linting**: No eslint or equivalent configured; style/quality checks unavailable.
- **Audit**: `npm audit` not run; would reveal known vulnerabilities in `pg` dependency.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Correctness / Data Integrity | Race condition in transfer: balance check and updates are not atomic | `src/ledger.js:9-17` — `balanceMinor()` is called to check the balance, then three separate `query()` calls are executed without transaction wrapping. A concurrent transfer from the same account can execute between the balance check and the account balance updates, causing overdraft or ledger mismatch. | Wrap all three `query()` calls in a database transaction using `BEGIN`, `COMMIT`, and `ROLLBACK`. Use the `pg` client's transaction API: `client.query('BEGIN')`, execute the three statements, then `client.query('COMMIT')` on success or `client.query('ROLLBACK')` on error. Alternatively, use a prepared transaction or application-level locking. |
| 2 | **Critical** | Correctness / Logic Error | Incorrect UPDATE statement for recipient: recipient ID is ignored in the UPDATE, always updates account at position `$2` (the sender's ID) | `src/ledger.js:13` — Line 13 updates `toId` account but uses `$2` parameter placeholder, which receives `toId` in `WHERE id = $2`, but the first UPDATE (line 12) also uses `$2` with `fromId`. This is ambiguous SQL that may cause the recipient's account to update incorrectly or error out depending on parameter binding order. | Change line 13 to use positional parameter `$3`: `UPDATE accounts SET balance_minor = balance_minor + $1 WHERE id = $3, [amountMinor, toId]`. Verify the parameter order matches the SQL placeholders: first `$1` = amount, second `$2` = fromId, third `$3` = toId. |
| 3 | **Critical** | Security | No input validation on transfer amounts or account IDs; negative amounts accepted | `src/ledger.js:8` — Function accepts `amountMinor` with no validation. Negative values would cause the balance check to pass when it should fail, allowing unauthorized transfers that move money in reverse. Account IDs are not validated as existing or belonging to the caller. | Add input validation: reject `amountMinor <= 0`, validate `fromId` and `toId` are valid UUIDs/integers and exist in the database, and verify the caller has authorization to transfer from `fromId`. |
| 4 | **High** | Reliability / Error Handling | Unhandled errors in critical path: no error handling on database queries | `src/ledger.js:9-16` — All `query()` calls lack `.catch()` or try-catch. If any query fails (network error, constraint violation, database down), the function silently returns `undefined` instead of an error response. The ledger entry may be recorded without updating balances, or vice versa, creating reconciliation failures. | Add try-catch wrapping all three query calls. If any fails, rollback the transaction and return `{ ok: false, reason: 'database error' }`. Re-throw after rollback if the error should propagate. |
| 5 | **High** | Reliability | Incomplete transfer leaves ledger in inconsistent state | `src/ledger.js:12-16` — If the ledger entry insert (line 14-17) fails after the balance updates succeed, the accounts are updated but the transaction is not recorded. Reconciliation will detect a balance mismatch the next run. | Use database transactions (see #1). Ensure all three operations succeed or all three fail as a unit. |
| 6 | **Medium** | Testing | Test does not verify functionality; only checks for presence of a string | `test/ledger.test.js:5-8` — The test reads the source file and asserts that `'insufficient funds'` appears as a string in the code. This verifies the code was not deleted, not that the function works correctly. No actual transfer is tested, no database interaction verified, and no edge cases checked. | Write real tests using a test database or mock: verify transfers succeed with sufficient funds, fail with insufficient funds, update both accounts correctly, record ledger entries, and handle concurrent transfers atomically. |
| 7 | **Medium** | Architecture | Database connection pool not closed on exit; resource leak on shutdown | `src/db.js:3` — The `pg.Pool` is created but never closed. On application shutdown, the pool connections remain open. If the process exits or crashes, database connections linger briefly before OS cleanup. | Call `pool.end()` on application shutdown, or use a process signal handler: `process.on('SIGTERM', () => { pool.end(); process.exit(0); })`. Ensure this is called in the application's main entry point. |
| 8 | **Low** | Maintainability | Missing error context in return value | `src/ledger.js:10` — When balance is insufficient, the function returns an error object, but no amount information is logged or returned. A caller cannot see how far short the balance was. | Add balance info to the error response: `return { ok: false, reason: 'insufficient funds', balance, requested: amountMinor };` This aids debugging and error handling. |

---

## Unconfirmed Issues

- **Unknown schema constraints**: The assessment assumes no unique constraints or foreign keys that would prevent the updates or insert. If `ledger_entries` has a unique constraint or `accounts` has ON DELETE CASCADE, the failure modes differ. The schema definition is not available.
  
- **Connection pool behavior under load**: The assessment does not load-test the connection pool. Under high concurrency, the pool may exhaust connections, leading to timeouts. Not examined.

---

## Summary

### Strengths

- **Parameterized queries in use**: All SQL statements use parameterized queries (`$1`, `$2`), which prevents SQL injection attacks in the query structure itself.
- **Simple, focused API**: The ledger module exposes only two functions (`balanceMinor()` and `transfer()`), reducing the attack surface and making the intended behavior clear.

### Key Risks

**Critical**: The transfer function is not atomic (Finding #1), allowing concurrent transfers from the same account to bypass the balance check. The recipient update has a logic error (Finding #2) that may not correctly credit the destination account. These two defects together make the system unsuitable for financial use until fixed.

**Critical**: Input validation is missing (Finding #3), allowing negative transfers and potentially unauthorized account transfers.

**High**: Database errors are unhandled (Finding #4), and partial failures leave the ledger inconsistent (Finding #5). A failed insert after successful balance updates creates an audit problem for nightly reconciliation.

**Medium**: The test suite is non-functional and does not verify the core transfer logic (Finding #6). No assurance that the code behaves correctly.

### Priority Order

1. **Fix the SQL parameter binding in the recipient UPDATE** (Finding #2) — This is a logic error that will cause transfers to fail or credit the wrong account. High likelihood of detection in testing; fix immediately.

2. **Wrap transfer logic in a database transaction** (Finding #1) — This is the most critical architectural issue. Concurrent transfers will corrupt the ledger. This is a prerequisite for any production deployment.

3. **Add input validation** (Finding #3) — Prevent negative amounts and validate account IDs exist and are authorized.

4. **Add error handling and transaction rollback** (Finding #4, #5) — Ensure failures leave the database in a consistent state.

5. **Write functional tests** (Finding #6) — Verify the fixed code works correctly under normal and concurrent scenarios.

6. **Add resource cleanup** (Finding #7) — Ensure the pool is closed on shutdown to prevent resource leaks.

7. **Enhance error responses** (Finding #8) — Low priority; improves debugging but does not affect correctness.

### Coverage Gaps

- **Database schema**: The `accounts` and `ledger_entries` table definitions are not available. Foreign keys, constraints, and indexes were not examined.
- **Integration tests**: No tests verify the actual database behavior; all tests are unit-level or schema-level.
- **Concurrency testing**: No load test or concurrent transfer scenarios were run to verify the race condition fix.
- **Deployment and monitoring**: How the application is deployed, configured with `DATABASE_URL`, and monitored for reconciliation failures is unknown.
- **Authorization and authentication**: How the caller's identity is verified and checked against `fromId` is not examined (likely handled in a calling layer).
- **npm audit output**: Dependency vulnerabilities were not checked; the `pg` version may have known CVEs.

