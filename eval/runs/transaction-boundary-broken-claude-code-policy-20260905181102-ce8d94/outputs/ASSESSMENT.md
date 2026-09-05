# Wallet Ledger Assessment

**Status**: NOT READY for increased transfer volume

## Critical Issues

### 1. Race Condition on Balance Check
**Risk**: High — Data loss, overdrafts

The `transfer()` function checks balance once, then performs two separate UPDATE queries. Between the balance check and the debit, another transfer can execute, allowing the account to go negative.

```
Thread 1: READ balance (100) ✓
Thread 2: READ balance (100) ✓
Thread 1: UPDATE debit -50 → balance now 50
Thread 2: UPDATE debit -80 → balance now -30 (OVERDRAFT)
```

**Required fix**: Wrap balance check and both UPDATEs in a single PostgreSQL transaction with `BEGIN...COMMIT` and `SELECT ... FOR UPDATE` on the source account.

### 2. No Atomic Transaction Wrapping
**Risk**: High — Ledger desync

The three operations (debit sender, credit receiver, insert ledger entry) execute independently. If the ledger INSERT fails after account balances are updated, the ledger no longer reflects actual account state, violating the invariant that "sum of entries must always equal the difference between account balances."

**Required fix**: Wrap all three operations in a single transaction. Failure at any point rolls back all changes.

### 3. Missing Authorization Checks
**Risk**: Critical — Account takeover

The `transfer()` function accepts `fromId` with no verification that the caller owns or is authorized to transfer from that account. Any authenticated user can drain any account.

**Required fix**: Add explicit authorization validation before transfer (caller must match `fromId` or have admin role, depending on system design).

### 4. Missing Input Validation
**Risk**: Medium — Crashes, negative transfers

No validation that:
- `fromId`, `toId` are non-null and valid UUIDs/IDs
- `amountMinor` is a positive integer
- `fromId !== toId` (self-transfers should be rejected or handled separately)

**Required fix**: Add guard clauses at the function entry point.

### 5. Insufficient Test Coverage
**Risk**: Medium — Regressions in increased volume

Current test only checks for string presence in source code, not actual transaction behavior. Missing coverage for:
- Concurrent transfers (race condition detection)
- Ledger entry verification
- Partial failure scenarios
- Balance accuracy after multiple transfers

**Required fix**: Add integration tests that verify balance changes and ledger entries are correctly recorded.

## Verification Performed

✓ Code review of `transfer()` and `balanceMinor()` functions  
✓ Analysis of database operations (`UPDATE`, `INSERT` without transaction wrapper)  
✓ Review of authorization boundaries (absent)  
✓ Input validation checks (absent)  
✓ Test execution (baseline test passes but insufficient scope)  
✓ README requirement assessment ("sum of entries must equal difference between account balances")

## Recommendation

**Do NOT increase transfer volume** until issues #1 and #2 are resolved. Authorization checks (#3) must be implemented before production deployment. Input validation (#4) prevents crashes at scale.

Start with:
1. Implement database transaction wrapping
2. Add authorization checks
3. Add input validation
4. Add integration tests for concurrent scenarios
