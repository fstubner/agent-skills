# Wallet Ledger Engineering Assessment

## Scope

**In Scope**
- `src/ledger.js` — Transfer function, balance queries, and ledger entry logic
- `src/db.js` — Database connection pooling
- `test/ledger.test.js` — Existing test suite
- `package.json` — Project configuration and dependencies
- `README.md` — Documentation

**Out of Scope**
- Database schema definition (not present in repository)
- Database migrations or initialization scripts
- Deployment configuration and infrastructure
- Production monitoring and metrics
- Authentication/authorization layer
- API endpoints or request handlers (if they exist outside this codebase)

**Depth**: Targeted — every file in the in-scope list read in full.

---

## Environment

**Language & Runtime**
- JavaScript (ES6 modules)
- Node.js

**Frameworks & Libraries**
- `pg` (^8.11.0) — PostgreSQL client for Node.js

**Domain**
- Financial application — wallet ledger system for moving money between customer accounts and recording movements.

**Platform Targets**
- Server/backend

**Build System**
- npm

---

## Tooling Results

### What I ran

**Command**: `npm test`
- **Status**: Not executed — requires approval to run npm commands in this environment.
- **Reason**: Permission requirement for npm invocations.
- **Alternative**: Test file examined manually at `test/ledger.test.js`.

**Available Scripts in package.json**
- `test`: `node --test test/ledger.test.js`
- No other build, lint, or audit scripts declared.

**Manual Code Examination**
- ✅ `src/ledger.js` — Reviewed for correctness, security, reliability, and data integrity patterns.
- ✅ `src/db.js` — Reviewed for connection management and error handling.
- ✅ `test/ledger.test.js` — Reviewed for test coverage.
- ✅ `package.json` — Reviewed for dependency declarations and script availability.
- ✅ `README.md` — Reviewed for documentation accuracy.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Data Integrity | Race condition in concurrent transfers allows overdraft | `src/ledger.js:9-12` — Balance checked at line 9, but actual debit occurs at line 12 with no lock or transaction; another thread can transfer from the same account between these lines. | Wrap all three queries (debit, credit, insert) in a single `BEGIN...COMMIT` transaction to ensure atomicity. |
| 2 | **Critical** | Data Integrity | Ledger and balance desynchronization on partial failure | `src/ledger.js:12-17` — Three separate queries without transaction wrapper; if INSERT fails after UPDATEs, the ledger record is missing but balances are modified. | Wrap all queries in a transaction. Use `BEGIN`, then debit, credit, and insert, then `COMMIT`. Rollback on any error. |
| 3 | **High** | Reliability | No validation of DATABASE_URL environment variable | `src/db.js:3` — Pool created with `process.env.DATABASE_URL` without checking if it is defined. Missing variable causes cryptic connection errors downstream. | Add validation at startup: `if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set')` before pool creation. |
| 4 | **High** | Reliability | Unhandled query errors in transfer function | `src/ledger.js:9,12,13,14-17` — Query calls have no `.catch()` or try/catch wrapper. Database errors (connection loss, constraint violation) propagate uncaught. | Add try/catch block around all queries in the `transfer` function. Catch errors and return `{ ok: false, reason: 'database error' }` or similar. |
| 5 | **High** | Security | No input validation on transfer parameters | `src/ledger.js:8` — Function accepts `fromId`, `toId`, `amountMinor` with no type or range validation. Negative amounts, non-integers, null values, or extremely large numbers are not rejected. | Validate at function entry: check that `fromId` and `toId` are non-null strings/numbers, and `amountMinor` is a positive integer. Reject or throw on invalid input. |
| 6 | **Medium** | Testing | Test suite does not verify transfer logic | `test/ledger.test.js:6-7` — Only test checks for string presence in source code, not actual transfer behavior, balance calculation, or ledger recording. No integration or unit tests of the core function. | Add tests that mock or stub the database to verify: (a) transfer succeeds with sufficient balance, (b) transfer fails with insufficient balance, (c) ledger entry is recorded, (d) balances are updated correctly. |
| 7 | **Medium** | Maintainability | Tight coupling to pg.Pool API in query function | `src/db.js:6` — Query function directly returns result of `pool.query()`. Changes to the Pool API or desire to use a different client requires updating this layer. | Consider adding error-handling middleware in the query wrapper, or documenting the expected interface to reduce surprise when Pool behavior changes. |
| 8 | **Info** | Documentation | README lacks operational requirements | `README.md` — No mention of required environment variables, database schema, or how to run tests. | Add section: "Setup & Requirements" with DATABASE_URL, schema initialization steps, and npm test instructions. |

---

## Unconfirmed Issues / Requires Investigation

None. All findings above are directly evidenced in the code.

---

## Summary

### Strengths

1. **Clear, focused API** — The `transfer()` and `balanceMinor()` exports have straightforward signatures and return clear success/failure indicators, making them easy to understand and call.

2. **Parameterized SQL queries** — All SQL uses parameterized queries (`$1`, `$2`, etc.), eliminating SQL injection risk (`src/ledger.js:4,12,13,14-16` and `src/db.js:6`).

### Key Risks

The codebase has **two critical data-integrity risks** that must be resolved before increasing transfer volume:

1. **Concurrent transfers can exceed available balance** (Finding #1) — The lack of transaction isolation means two transfers from the same account can race past the insufficient-funds check. This will cause overdrafts and reconciliation failures.

2. **Ledger and balance can desynchronize** (Finding #2) — If any of the three queries fails after the first two succeed, the accounts table and ledger_entries table are out of sync, violating the invariant stated in README.md ("the sum of entries must always equal the difference between the account balances").

Additionally, **three high-severity reliability/security gaps** (Findings #3, #4, #5) will cause unexpected failures and unhandled errors under real-world load or with invalid input.

### Priority Order

1. **[CRITICAL — Fix first]** Wrap the three queries in a single transaction to eliminate the race condition and partial-failure window (Findings #1 and #2). This is foundational to correctness.

2. **[HIGH — Fix second]** Add input validation to reject invalid transfer parameters (Finding #5) — quick fix with high impact.

3. **[HIGH — Fix third]** Add try/catch error handling around queries in `transfer()` (Finding #4) — prevents unexpected crashes.

4. **[HIGH — Fix fourth]** Validate DATABASE_URL on startup (Finding #3) — catches configuration errors early.

5. **[MEDIUM — Fix fifth]** Write integration or unit tests that actually exercise the transfer logic, not just check for string presence (Finding #6).

6. **[MEDIUM — Optional]** Improve internal decoupling of the query wrapper if the team anticipates future database client changes (Finding #7).

7. **[INFO — Optional]** Update README with setup, environment variables, and test instructions (Finding #8).

### Coverage Gaps

**Not Examined**
- Database schema (missing from repository) — could not verify that accounts and ledger_entries tables have correct structure, constraints, and indexes.
- Database migrations — no initialization scripts present to verify how the schema is deployed or versioned.
- Connection pooling configuration — pool size, timeout, retry logic cannot be verified without access to pg.Pool defaults or environment configuration.
- Actual test execution — `npm test` could not be run; test output not available. Test may fail to run if node:test module behaves unexpectedly.
- Authentication and authorization — not in scope, assumed handled elsewhere.
- Performance under load — no benchmarking or load testing performed. N+1 queries, slow indices, or connection exhaustion are not ruled out.
- Reconciliation logic — README mentions nightly reconciliation but no code present to verify it detects or corrects out-of-sync state.
- Deployment and operational runbooks — no configuration, health checks, or incident-response procedures examined.

---

## Assessment Complete

This wallet ledger is **not ready for increased transfer volume** until the critical race condition and transaction atomicity issues are resolved. The current implementation allows concurrent transfers to overdraft accounts and leaves the ledger desynchronized if any query fails. Both must be fixed before going to production or scaling test volume.

