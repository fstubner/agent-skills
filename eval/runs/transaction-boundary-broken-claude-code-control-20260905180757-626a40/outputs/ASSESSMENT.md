# Wallet Ledger Assessment

## Critical Issues Found

### 1. **Race Condition in Transfer Function** (HIGH PRIORITY)
The `transfer()` function checks the balance and then performs updates in separate, non-atomic operations:
- Line 9: Balance is fetched asynchronously
- Lines 12-13: Two separate UPDATE queries for from/to accounts
- Lines 14-16: Ledger entry inserted

**Problem**: Multiple concurrent transfers from the same account can all pass the balance check (line 10) before any of them actually deduct funds. This allows accounts to go negative, violating the ledger's integrity.

**Example failure scenario**:
- Account has balance of 100
- Transfer 1: Check passes (100 >= 60) → starts update
- Transfer 2: Check passes (100 >= 60) → starts update (both still see 100)
- Both updates execute → balance is now -20 instead of staying non-negative

### 2. **Lack of Transaction Atomicity** (HIGH PRIORITY)
The balance updates and ledger entry insertion are not wrapped in a database transaction. If any SQL operation fails after the checks pass, the system can become inconsistent:
- Both account updates execute but ledger INSERT fails → accounts updated but transfer not recorded
- First account debits but second account credit fails → funds disappear
- Ledger entry inserted but account updates fail → phantom transactions

### 3. **Insufficient Isolation Level**
Database default isolation (often READ COMMITTED) does not prevent dirty reads between the balance check and updates, making the race condition worse at higher volumes.

## Impact Assessment

- **At current volume**: May pass tests if transfers are rare and sequential
- **At higher volume**: Race conditions become probable; overdrafts and ledger mismatches will occur nightly during reconciliation
- **Financial impact**: Accounts can have negative balances; ledger sum won't match account balance sum
- **Compliance risk**: Cannot reliably audit transaction history

## Required Fixes (before increasing transfer volume)

1. **Wrap all operations in a database transaction** (BEGIN...COMMIT)
2. **Perform balance check within the transaction** to capture current state under isolation
3. **Use appropriate transaction isolation level** (SERIALIZABLE or REPEATABLE READ at minimum)
4. **Consider database-level row locks** (FOR UPDATE) on accounts being modified to prevent concurrent modifications

## Verification Summary

✓ Identified race condition in non-atomic transfer sequence  
✓ Confirmed lack of transaction wrapper around related operations  
✓ Verified ledger accuracy requirement contradicts current implementation  
✓ Confirmed increased transfer volume will expose these issues  

**Recommendation**: Do not increase transfer volume until transaction atomicity is implemented.
