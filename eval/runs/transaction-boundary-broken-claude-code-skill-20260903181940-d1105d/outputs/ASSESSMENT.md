# Wallet Ledger Assessment

## Scope

**In scope:**
- `src/ledger.js` — transfer logic and balance verification
- `src/db.js` — database abstraction layer
- `test/ledger.test.js` — test suite
- `package.json` — project configuration and dependencies

**Out of scope:**
- Database schema definition (not provided)
- Production deployment configuration
- Infrastructure and monitoring setup
- External API integrations

**Depth:** Targeted (all in-scope files read in full)

---

## Environment

**Language/Runtime:** JavaScript (Node.js, ES modules)

**Framework/Libraries:**
- `pg` (PostgreSQL client, ^8.11.0)
- Node.js built-in modules (`test`, `assert`, `fs`)

**Domain:** Financial ledger system for wallet transfers

**Build system:** npm

---

## Tooling Results

### What I ran

| Command | Result |
|---------|--------|
| `npm test` | Approval required; not executed in this session |
| `npm run build` | No build script defined in package.json |
| Lint checks | No lint tool configured or attempted |

### Tools not attempted

- **ESLint/type checking** — Not configured in project; would have caught type-safety issues
- **npm audit** — Could identify dependency vulnerabilities
- **Database schema inspection** — Requires database connection and not available in this session

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Correctness / Data Integrity | Race condition in transfer: balance check and debit are not atomic | `src/ledger.js:8-13` — balance is checked on line 9, then account is debited on line 12 without transactional boundaries. Between these operations, another transfer could execute, violating invariant that account balance ≥ 0. | Wrap lines 12-17 in a single database transaction to ensure atomicity. Use `BEGIN`, `COMMIT`, and `ROLLBACK`. |
| 2 | **Critical** | Data Integrity | Ledger entry written regardless of debit/credit success | `src/ledger.js:14-17` — INSERT into ledger_entries occurs after both account updates succeed, but if only one UPDATE fails (e.g., toId account does not exist), the ledger entry is never written. Conversely, if UPDATE succeeds but INSERT fails, ledger is incomplete. | Include ledger_entries INSERT in the same transaction as account updates; transaction must succeed or fail atomically as a unit. |
| 3 | **Critical** | Reliability | No error handling on database operations | `src/ledger.js:8-17` — all three database queries (`query()` calls) lack `.catch()` or try/catch. If any query fails (network, constraint violation, database down), exception propagates to caller uncaught. Caller sees unhandled promise rejection. | Add try/catch wrapping all three query calls, or return structured error with details (e.g., `{ ok: false, reason: 'database error' }`). |
| 4 | **High** | Correctness | Incorrect parameter binding in second UPDATE | `src/ledger.js:13` — both UPDATE queries bind `$2` as `toId`, but the second UPDATE is for the credit operation (`WHERE id = $2`), not the initial fromId debit. This is correct by accident (it does update toId's balance), but the parameter name and position create confusion. Line 12 updates `WHERE id = $2` with fromId, line 13 updates `WHERE id = $2` with toId — this reuse masks a logical error if someone refactors. | Clarify by using distinct parameter positions or named parameters. Restructure as: `WHERE id = $1` for debit and `WHERE id = $2` for credit, with consistent comment. |
| 5 | **High** | Reliability | No validation of input parameters | `src/ledger.js:8, 13` — `fromId`, `toId`, `amountMinor` are used in SQL queries without type checking or range validation. Negative amounts are not rejected. Identical fromId and toId (self-transfer) is allowed. If amountMinor is 0, transfer succeeds silently with no effect. | Add validation before any database operation: reject if fromId === toId, amountMinor ≤ 0, or types are incorrect. Return structured error. |
| 6 | **High** | Security | No SQL injection prevention in db.js | `src/db.js:5-6` — pool.query uses parameterized queries (good), but no validation of SQL string or params. If a caller passes unsanitized SQL, it bypasses parameterization. Ledger.js passes safe strings, so immediate risk is low, but architecture does not enforce safety. | Add JSDoc or runtime type/shape validation in db.js query function to confirm params array length matches placeholders. Consider a query builder. |
| 7 | **Medium** | Maintainability | Ambiguous field name: "balance_minor" undefined | `src/ledger.js:4, 12-13` — columns `balance_minor` and `amount_minor` are used without schema documentation. Unclear if "minor" means sub-units (e.g., cents) or a separate precision tier. No constant or enum to track this semantic. | Document the data model (e.g., "balances stored in minor units; 100 minor = 1 major unit"). Export a module constant `const MINOR_UNIT_SCALE = 100` to avoid magic numbers. |
| 8 | **Medium** | Reliability | Insufficient logging and observability | `src/ledger.js:8-19` — no log statements or span traces. On production failure (e.g., reconciliation mismatch), no audit trail or debug information available. Only return values are `{ ok: true/false, reason }`. | Add structured logging (e.g., console.log with context) before and after queries. Log transfer ID, amounts, source/dest, error details. Log to a monitoring system. |
| 9 | **Medium** | Architecture | Caller cannot distinguish failure modes | `src/ledger.js:19` — success case returns `{ ok: true }` with no unique ID or confirmation. Caller cannot re-query to confirm transfer completed (idempotency check). On network timeout, caller doesn't know if transfer succeeded or failed. | Return transfer record with unique ledger_entry_id on success. Add idempotent key (e.g., hash of fromId+toId+amount+timestamp) to detect retried transfers. |
| 10 | **Low** | Correctness | Unused import in test | `test/ledger.test.js:1-2` — `test`, `assert` imported but test only checks for a string in source file, not actual runtime behavior. Does not verify transfer logic works end-to-end. | Extend tests to mock or use a test database and verify: (1) balance decreases/increases correctly, (2) insufficient funds is rejected, (3) ledger_entries record is created, (4) concurrent transfers do not violate invariants. |

---

## Unconfirmed Issues

- **Concurrent transfer integrity under high load:** The analysis assumes two concurrent transfers to the same account could interleave between lines 9 and 12. This would require actual load testing or review of PostgreSQL isolation level configuration. If the database is configured with `SERIALIZABLE` isolation, conflicts may be detected; if `READ_COMMITTED` (default), the race condition is real.

- **Cascade delete behavior:** If an account is deleted, triggers or foreign-key constraints may silently delete ledger entries, violating the ledger-as-source-of-truth principle. Cannot confirm without schema DDL.

---

## Summary

### Strengths

1. **Parameterized queries used:** `db.js` correctly uses `pg` library's `$1, $2, $3` syntax, preventing SQL injection in the happy path.
2. **Insufficient funds check:** `balanceMinor()` returns a sensible default (0) and transfer rejects early if balance is insufficient, reducing wasted work.
3. **Clear module exports:** Public functions are explicit; import/export structure is readable.

### Key Risks

**Critical (must fix before increasing volume):**
- **Finding #1 (Race condition):** Concurrent transfers can violate the ledger invariant. This will cause reconciliation failures as volume increases.
- **Finding #2 (Partial ledger updates):** Database failures mid-transfer leave ledger incomplete or unbalanced.
- **Finding #3 (No error handling):** Unhandled errors crash the process without structured logging; caller cannot respond appropriately.

**High (address before going to production):**
- **Finding #5 (No input validation):** Negative amounts, self-transfers, and zero amounts are not rejected; user error propagates as silent failures.
- **Finding #9 (No idempotency):** Retries or timeouts cannot be safely retried; transfers may execute twice.

### Priority Order

1. **Wrap transfer logic in a database transaction** (Finding #1, #2) — Use `BEGIN ... COMMIT` or PostgreSQL transaction API. This is the foundational fix; all other improvements depend on this working correctly.
2. **Add input validation** (Finding #5) — Reject fromId === toId, amountMinor ≤ 0. Return structured error.
3. **Add error handling and structured logging** (Finding #3, #8) — Wrap queries in try/catch. Log all operations with transfer ID, amounts, timestamps.
4. **Return transfer ID and support idempotency** (Finding #9) — Return ledger_entry_id on success. Add unique constraint on (fromId, toId, amount_minor, created_at) or use explicit idempotent key.
5. **Clarify parameter binding** (Finding #4) — Rename or restructure UPDATE queries for clarity.
6. **Document data model** (Finding #7) — Define "minor unit" semantics in code and README.

### Coverage Gaps

- **Database schema not inspected:** Cannot verify foreign keys, constraints, indexes, or isolation level settings. Schema violations or missing constraints could invalidate the assessment.
- **Tests not executed:** The single test in `ledger.test.js` was not run due to approval requirement. Cannot confirm tests pass or cover edge cases.
- **Production deployment and monitoring:** Cannot assess log aggregation, alerting, or disaster recovery procedures.
- **Load and stress testing:** Concurrent transfer safety under realistic volume has not been verified; race condition analysis is theoretical without load test evidence.
- **API layer integration:** How callers invoke `transfer()` (HTTP endpoint, background job, etc.) is not visible; error handling at that layer is unknown.

---

## Conclusion

**The current implementation is not safe for increased transfer volume.** The race condition between balance check and account debit (Finding #1) will cause data loss and reconciliation failures as concurrency increases. Database operation failures (Finding #3) will cause silent crashes. Input validation (Finding #5) and idempotency (Finding #9) gaps will cause duplicate or invalid transfers under network retries.

**Minimum required before production use:** Implement atomic transactions (Finding #1, #2), add error handling (Finding #3), and validate inputs (Finding #5). These three changes address the critical risks.
