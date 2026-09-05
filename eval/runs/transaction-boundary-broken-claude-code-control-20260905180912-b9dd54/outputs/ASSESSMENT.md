# Wallet Ledger Assessment

## Executive Summary

**STATUS: NOT READY for increased transfer volume**

The wallet ledger system has critical concurrency issues that violate its core reconciliation guarantee. Under higher transfer volume, these race conditions will cause account balances to diverge from ledger entries, breaking financial integrity.

## Critical Issues

### 1. Race Condition in Balance Validation (SEVERITY: Critical)

**Location**: `src/ledger.js:9-12`

**Problem**: The balance check and account deduction are not atomic. Multiple concurrent transfers from the same account can all pass the insufficient funds check before any deduction executes.

**Scenario**:
- Account has balance: $100
- Two concurrent transfers, each for $80
- Thread 1: Gets balance ($100) ✓
- Thread 2: Gets balance ($100) ✓
- Thread 1: Deducts $80 (balance now $20)
- Thread 2: Deducts $80 (balance now -$60) ✓ NEGATIVE BALANCE
- Ledger records two $80 transfers
- **Result**: Account is overdrawn; reconciliation fails

**Impact**: Increased transfer volume increases concurrent request probability, making this failure inevitable.

### 2. Ledger-to-Account Sync Failure (SEVERITY: Critical)

**Location**: `src/ledger.js:8-19`

**Problem**: Account updates (lines 12-13) and ledger insertion (line 14-16) are separate, unprotected operations. If an account update succeeds but ledger insertion fails (DB error, constraint violation, etc.), the system becomes permanently inconsistent.

**Scenario**:
- Accounts deducted and credited successfully
- Ledger insert fails (e.g., connection drops)
- Request returns error to client
- Client retries, which may succeed the second time
- Ledger now shows the transfer twice
- OR: Ledger never records the transfer at all
- **Result**: Accounts exist that don't match any ledger entries

**Impact**: Finance reconciliation will detect inconsistencies nightly but cannot determine which is correct: the account balance or the ledger entry.

### 3. No Transaction Boundaries (SEVERITY: Critical)

**Location**: `src/ledger.js:8-19`

**Problem**: The entire transfer operation lacks database transaction protection. The three operations (source deduction, destination credit, ledger entry) execute independently without rollback capability.

**Impact**: 
- Partial failures leave the system in an inconsistent state
- No atomic "all or nothing" guarantee
- Cannot use database-level constraints to enforce business logic

## Operational Risks

### Insufficient Funds Enforcement Broken Under Load
At higher transfer volumes, false negatives become common: transfers that *should* be rejected will succeed, overdrafting accounts.

### Reconciliation Will Fail Nightly
Finance's nightly reconciliation depends on `sum(ledger_entries) == sum(account_balance_changes)`. Race conditions will cause mismatches with no clear recovery path.

### No Audit Trail for Failed Operations
Partial failures leave no clear record of what happened or how to recover. Was the money moved or not?

## Recommendations Before Scaling

**Required fixes** (not implemented, just identified):
1. Wrap the entire transfer operation in a single database transaction
2. Check balance within the transaction after acquiring a row-level lock to prevent concurrent reads
3. Verify ledger entry succeeds before returning success to client
4. Consider idempotency keys to handle client retries safely

**Minimum viable protection**:
- Use `BEGIN ... COMMIT` transaction blocks
- Acquire `SELECT ... FOR UPDATE` locks on source account to serialize concurrent transfers from same account
- Ensure all three operations (deduct, credit, record) complete or all roll back atomically

## Testing Gaps

The current test suite (`test/ledger.test.js`) only verifies that the code contains error-handling text—it does not test actual transfer behavior, account state changes, ledger integrity, or concurrent operation.

## Conclusion

The system is suitable only for low-volume, serialized transfers. Increasing transfer volume without addressing concurrency and atomicity will corrupt financial data and break the core reconciliation guarantee stated in README.md.
