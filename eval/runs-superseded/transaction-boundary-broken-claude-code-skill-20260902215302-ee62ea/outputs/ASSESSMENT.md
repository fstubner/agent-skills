# Wallet Ledger Assessment

## Scope

**In scope (targeted depth):**
- `src/ledger.js` — core transfer and balance functions
- `src/db.js` — database connection module
- `test/ledger.test.js` — test suite
- `package.json` — dependencies and scripts

**Out of scope:**
- Deployment configuration (not present)
- Infrastructure / database schema (assumed to exist)
- Client code or API handlers that call these functions
- Load testing or performance benchmarking
- Production usage metrics or monitoring

**Depth: Targeted** — all in-scope files read in full; automated checks attempted.

---

## Environment

**Language & Runtime:** Node.js (ES modules)  
**Database:** PostgreSQL (via `pg` client)  
**Domain:** Wallet ledger system for moving money between customer accounts  
**Key dependency:** `pg` ^8.11.0

---

## What I Ran

| Command         | Result                                                                                        |
|-----------------|-----------------------------------------------------------------------------------------------|
| `npm test`      | Could not be executed — requires approval in this sandbox environment                        |
| `npm audit`     | Could not be executed — requires approval in this sandbox environment                        |
| No build step   | No build or compile step declared in package.json; code is interpreted                        |
| No lint config  | No linter configured (no eslint, prettier, etc. in package.json)                            |

---

## Findings Table

| # | Severity | Area              | Finding                                    | Evidence                              | Recommendation                                                                                  |
|---|----------|-------------------|--------------------------------------------|--------------------------------------|-------------------------------------------------------------------------------------------------|
| 1 | Critical | Correctness       | Race condition between balance check and updates | `src/ledger.js:9-10` (balance check) vs. `src/ledger.js:12-13` (updates are separate queries) | Move all three operations (debit, credit, ledger insert) into a single database transaction with `BEGIN`, `COMMIT`, and `ROLLBACK` handling |
| 2 | Critical | Data Integrity    | Partial failure leaves ledger inconsistent | `src/ledger.js:12-17` — if query on line 13 or 15 fails after line 12 succeeds, account is debited but not credited and ledger entry missing | Wrap all three mutations in a transaction; if any fails, rollback all. Add error handling with try-catch               |
| 3 | High     | Reliability       | Missing parameter validation              | `src/ledger.js:8` — function accepts `amountMinor` without checking if positive; `fromId`, `toId` unchecked | Add validation: `if (amountMinor <= 0) return { ok: false, reason: 'invalid amount' }` and `if (!fromId || !toId)` check |
| 4 | High     | Reliability       | Silent default for missing accounts        | `src/ledger.js:5` — `balanceMinor()` returns 0 if account not found; conflates missing account with zero balance | Either throw an error for missing accounts, or explicitly check that both accounts exist before transfer                |
| 5 | Medium   | Maintainability   | Test validates string presence, not behavior | `test/ledger.test.js:5-8` — test only checks if source code contains "insufficient funds", does not run `transfer()` | Rewrite test to mock database or use test fixtures; call `transfer()` with low balance and verify it returns `{ok: false}` |

---

## Unconfirmed Issues

**Session-manager concurrency (requires runtime access):**  
If multiple transfers targeting the same account occur in parallel, even with parameterized queries, the non-transactional structure means:
- Thread A checks balance (sufficient), Thread B checks balance (sufficient)
- Thread A updates accounts, Thread B updates accounts — both see the original balance
- Result: overdraft without being detected

This requires running the code under concurrent load to confirm, which is out of scope. Mitigation is the same as findings #1 and #2.

---

## Summary

### Strengths

- **Parameterized queries:** All SQL uses parameterized inputs (`$1`, `$2`, `$3`) with bound parameters, preventing SQL injection attacks. (`src/ledger.js:4, 12-16`)
- **Clear module structure:** Separation of concerns between database connection (`db.js`) and business logic (`ledger.js`) is clean and maintainable.

### Key Risks

**Critical issues #1 and #2 must be fixed before increasing transfer volume.** The system currently lacks transaction safety:

- Multiple sequential queries without transaction boundaries means a failure mid-transfer leaves the ledger in an inconsistent state — violating the reconciliation guarantee stated in `README.md`.
- A concurrent transfer hitting the same account between the balance check (line 9) and the updates (lines 12–13) can cause overdraft to go undetected.

Both scenarios are data-loss and financial-correctness risks. The nightly reconciliation mentioned in the README will detect mismatch but cannot repair an already-completed bad transfer.

### Priority Order

1. **[Critical — Fix #1 & #2]** Wrap the debit, credit, and ledger insert in a database transaction with rollback on any error.
   - **Effort:** Low (PostgreSQL transactions are straightforward with pg client's built-in transaction support)
   - **Blast radius:** All transfers; fixes the highest-impact risk.

2. **[High — Fix #3 & #4]** Add parameter validation (amount > 0, accounts exist) before attempting transfer.
   - **Effort:** Low
   - **Impact:** Catches invalid operations before they hit the database.

3. **[Medium — Fix #5]** Rewrite tests to exercise the actual `transfer()` function logic rather than checking source code strings.
   - **Effort:** Low
   - **Impact:** Tests become a meaningful validation of correctness.

### Coverage Gaps

- **Database schema not examined:** The existence and structure of `accounts` and `ledger_entries` tables are assumed based on code. No `CREATE TABLE` statements were available.
- **Runtime tests not executed:** The test suite could not be run in this environment. Results are based on code review only.
- **Linting and type checking:** No TypeScript types or ESLint configuration present; static analysis was not performed.
- **Performance characteristics:** No load testing, query performance analysis, or database indexing review.
- **Production deployment:** Environment variables, connection pooling settings, and production configuration not examined.
- **Backup and recovery procedures:** Not in scope; assume handled externally.

