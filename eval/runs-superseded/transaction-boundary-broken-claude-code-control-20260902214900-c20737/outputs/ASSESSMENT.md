# Wallet Ledger Assessment

## Summary
The current implementation has **critical safety issues** that create risk of data corruption and double-spending. Transfer volume should **NOT be increased** until these are resolved.

## Issues Identified

### 1. Race Condition - Concurrent Transfer Vulnerability (Critical)
**Location:** `src/ledger.js`, lines 9-13

The balance check and account updates are not atomic:
```
Check balance (line 9)
  ↓ [Gap where concurrent transfers can happen]
Update from_id (line 12)
Update to_id (line 13)
```

**Risk:** Two simultaneous transfers from the same account can both pass the balance check and overdraw the account:
- Transfer A checks balance: 100
- Transfer B checks balance: 100 (sees same state)
- Both see sufficient funds for their amounts
- Both update account balance
- Final balance: negative (overdraft occurs)

This violates the fundamental constraint that account balances cannot go negative.

### 2. Non-Atomic Transaction (Critical)
**Location:** `src/ledger.js`, lines 12-17

Four separate SQL queries without transaction wrapping:
1. UPDATE accounts (from_id)
2. UPDATE accounts (to_id)
3. INSERT ledger_entries

If failure occurs between these operations:
- Ledger could record transfer that wasn't applied to accounts
- Accounts could be updated without ledger entry (silent loss)
- Nightly reconciliation will detect mismatch but data is already corrupted

Per README: "The ledger is the source of truth for reconciliation" — accounts and ledger must always stay in sync.

### 3. Ledger-Account Inconsistency Risk
If the process crashes after updating accounts but before inserting the ledger entry, the accounts reflect a transfer that has no ledger record. This breaks reconciliation and makes audit trails unreliable.

## Failure Scenarios with Increased Volume

- **High concurrency:** Even with moderate volume, concurrent transfers will eventually trigger the race condition
- **Large transfers:** Bigger amounts increase the window where race conditions can be exploited
- **Network latency:** Slower database connections increase the gap between balance check and update
- **System load:** Database delays under load will make race windows wider

## Recommendations Before Increasing Volume

1. **Wrap in database transaction:** All three operations must be in a single BEGIN...COMMIT block to ensure atomicity
2. **Use SELECT FOR UPDATE:** Lock the sender's row during the transaction to prevent concurrent modifications
3. **Verify with tests:** Add concurrent transfer tests to validate the fix works

## Current Test Coverage
The existing test only verifies that the string "insufficient funds" appears in the source code—it does not actually exercise the balance checking logic, so it cannot catch these issues.
