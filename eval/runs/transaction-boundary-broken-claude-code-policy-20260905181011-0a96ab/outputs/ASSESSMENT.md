# Wallet Ledger Assessment

## Overview
The wallet ledger system records balance updates and ledger entries. Assessment of readiness for increased transfer volume reveals **critical data integrity issues** that must be resolved before scaling.

## Critical Issues

### 1. Race Condition in Transfer (src/ledger.js:8-20)
**Severity:** CRITICAL — Breaks balance guarantee

The transfer function reads the balance once, then performs updates without atomicity:
```
1. Read balance (line 9)
2. Check balance < amountMinor (line 10)  
3. UPDATE accounts from (line 12)
4. UPDATE accounts to (line 13)
5. INSERT ledger_entries (line 14-17)
```

Between steps 2 and 3, a concurrent transfer can drain the source account, violating the check. At higher volumes, multiple overlapping transfers will routinely fail the balance guarantee or create negative balances.

**Example failure scenario:** 
- Account A has 100 minor units
- Thread 1: reads balance (100), passes check
- Thread 2: reads balance (100), passes check
- Thread 1: debits 100 → balance becomes 0
- Thread 2: debits 100 → balance becomes -100 (invalid)

### 2. No Transaction Atomicity (src/ledger.js:12-17)
**Severity:** CRITICAL — Breaks reconciliation

The three operations are independent queries:
- If both UPDATEs succeed but INSERT fails, accounts and ledger diverge
- If an INSERT succeeds but one UPDATE fails, ledger has phantom entry
- The README states: "sum of entries must always equal difference between account balances" — this is violated when operations fail mid-sequence

At higher transfer volumes, network failures and retries become common, making this failure mode certain.

### 3. No Authorization Validation (src/ledger.js:8)
**Severity:** HIGH — Trust boundary violation

The transfer function accepts `fromId` and `toId` with no validation that the caller is authorized to debit `fromId`. Any authenticated request can transfer from any account.

### 4. Insufficient Test Coverage (test/ledger.test.js:5-8)
**Severity:** MEDIUM — Cannot detect regressions

The single test only checks that the string "insufficient funds" appears in the source file. It does not:
- Verify actual transfer behavior
- Test race conditions
- Validate ledger consistency
- Check that unauthorized transfers fail
- Verify transaction rollback on failure

## Blocking Conditions for Scale

| Issue | Impact at Scale |
|-------|-----------------|
| Race condition | Negative balances, reconciliation failures accumulate |
| No transactions | Ledger-account mismatch, split-brain state |
| No auth checks | Any user can drain any account undetected |
| No integration tests | Failures hidden until production reconciliation fails |

## Verified Implementation Details

✓ Dependencies: `pg` module available for transactions
✓ Code structure: Modular (db.js isolation, clean exports)
✓ Syntax: Code is valid JavaScript with await/async support
✓ Fallback logic: Returns `{ ok: false, reason: ... }` on failure

## Recommendation

**Do not increase transfer volume until:**

1. **Wrap all three operations (select, update, update, insert) in a single PostgreSQL transaction** — use `BEGIN...COMMIT` or a transaction client to guarantee atomicity

2. **Add authorization check** — validate that the caller is the account owner or has explicit permission before calling transfer

3. **Add integration tests** that:
   - Verify concurrent transfers don't breach balance
   - Confirm ledger always matches account balance difference
   - Validate unauthorized transfers are rejected
   - Test failure scenarios (network, DB errors)

4. **Address uncertainty**: Clarify what identifies the caller and what authorizes a transfer (token claim, session, role-based access control)

Once these are complete, the system will be safe for higher volume and auditable for reconciliation.
