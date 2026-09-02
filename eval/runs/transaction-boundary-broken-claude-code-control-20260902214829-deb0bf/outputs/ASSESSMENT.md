# Wallet Ledger Assessment

## Critical Issues Found

### 1. Race Condition in Balance Validation
**Severity:** CRITICAL

The `transfer()` function checks the balance and then updates it in separate, non-atomic operations:

```
Line 9:  const balance = await balanceMinor(fromId);    // Check
Line 10: if (balance < amountMinor) return {...};       // Validate
Line 12-13: UPDATE accounts SET balance_minor = ...     // Update
```

**Problem:** Between the balance check (line 9) and the update (line 12), another concurrent transfer from the same account can execute, causing the insufficient funds check to be bypassed. Multiple concurrent transfers can overdraft an account.

**Example:** 
- Account has $100
- Two transfers of $80 each are initiated concurrently
- Both see $100 balance, both pass validation
- Both execute, resulting in account balance of -$60

### 2. Non-Atomic Operations
**Severity:** CRITICAL

The balance updates and ledger entry insertion are not performed in a single transaction:

```
Line 12-13: UPDATE accounts (two separate queries)
Line 14-17: INSERT into ledger_entries
```

**Problem:** If the ledger insert fails, the account balances have already been modified, breaking the fundamental reconciliation guarantee that "sum of entries must equal the difference between account balances."

### 3. Application-Level Validation
**Severity:** HIGH

The balance check is performed at the application level rather than in the database. This creates a TOCTOU (Time-of-Check-Time-of-Use) vulnerability.

**Problem:** 
- No database constraint prevents overdrafts
- Application crashes, network failures, or multiple application instances can cause inconsistency
- Scale increases this risk

## Ledger Integrity Risk

The README states: "The ledger is the source of truth for reconciliation: the sum of entries must always equal the difference between the account balances."

**Current State:** This invariant cannot be maintained with the current implementation due to:
- Possible overdrafts from race conditions
- Possible ledger/balance mismatches from non-atomic operations

## Recommendations Before Scaling Transfer Volume

1. **Wrap operations in a database transaction** - Use BEGIN/COMMIT to make all three operations (two balance updates + one ledger insert) atomic
2. **Move balance validation to the database** - Use a trigger or constraint to prevent negative balances at the database level
3. **Consider using a single UPDATE with ledger insert** - Reduce the number of round trips and operations
4. **Add database-level foreign key constraints** - Ensure account IDs exist before transfer
5. **Monitor reconciliation** - The nightly finance reconciliation must catch overdrafts and mismatches if they occur

## Verification Summary

✓ Reviewed transfer logic in `src/ledger.js`
✓ Identified race condition in balance check/update sequence
✓ Confirmed non-atomic operations between balance and ledger
✓ Verified README reconciliation requirements against implementation
✓ Assessed readiness for increased transfer volume: **NOT SAFE**

**Recommendation:** Do not increase transfer volume until race condition and atomicity issues are addressed.
