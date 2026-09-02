# Wallet Ledger Safety Assessment

**Recommendation: DO NOT increase transfer volume until critical issues are resolved.**

## Executive Summary

The wallet ledger implementation has a critical race condition that violates double-entry bookkeeping. The ledger sum will diverge from account balances under concurrent load. This risk compounds dramatically with transfer volume increase.

## Critical Issues

### 1. Race Condition in Balance Check (CRITICAL)
**File:** `src/ledger.js:9-12`

The balance is read, then updated in separate operations without atomicity:
```javascript
const balance = await balanceMinor(fromId);  // Line 9: Query 1
if (balance < amountMinor) return { ok: false, reason: 'insufficient funds' };
await query('UPDATE accounts SET balance_minor = balance_minor - $1 WHERE id = $2', [amountMinor, fromId]);  // Line 12: Query 2
```

**Failure scenario:** Two concurrent transfers from the same account:
- Account has balance: 100
- Transfer 1 reads balance: 100
- Transfer 2 reads balance: 100
- Transfer 1 debits: -60 (balance → 40)
- Transfer 2 debits: -60 (balance → -20) ← **Overdraft**

**Impact:** Insufficient funds check is bypassed. Negative balances can occur.

### 2. Non-Atomic Operations (CRITICAL)
**File:** `src/ledger.js:12-16`

Three separate INSERT/UPDATE statements without transaction wrapping:
```javascript
await query('UPDATE accounts SET balance_minor = balance_minor - $1 WHERE id = $2', ...);  // Query 2: Debit
await query('UPDATE accounts SET balance_minor = balance_minor + $1 WHERE id = $2', ...);  // Query 3: Credit
await query('INSERT INTO ledger_entries (from_id, to_id, amount_minor) VALUES ($1, $2, $3)', ...);  // Query 4: Ledger entry
```

**Failure scenarios:**
- Debit succeeds, credit fails → money disappears from from_id but doesn't appear in to_id
- Credit succeeds, ledger entry fails → balance change recorded but no audit trail
- Application crash mid-transfer → partial state recorded

**Impact:** Ledger sum ≠ account balance difference. Finance reconciliation fails.

### 3. Ledger-Balance Divergence Under Load (HIGH)
The README states: "the sum of entries must always equal the difference between the account balances."

With concurrent transfers and the race condition above, this invariant breaks:
- Each race condition permits overdrafts
- Overdrafts are not recorded in ledger entries (only valid transfers are)
- Ledger sum < actual balance change
- Nightly reconciliation detects discrepancies that cannot be resolved

**Impact:** Increasing transfer volume increases concurrent races. Reconciliation failures scale linearly.

### 4. Missing Input Validation (MEDIUM)
**File:** `src/ledger.js:8`

No validation at the trust boundary:
- No check that `fromId ≠ toId` (self-transfer allowed, balance inflates)
- No check that `amountMinor > 0` (negative amounts debit the wrong direction)
- No check that both accounts exist (silent failure if account doesn't exist)
- No check that amount is an integer (floating-point rounding)

**Impact:** Invalid transfers silently succeed or behave unexpectedly.

### 5. Insufficient Error Handling (MEDIUM)
**File:** `src/ledger.js`

Database errors are not caught or logged:
```javascript
await query(...)  // Throws on network failure, constraint violation, deadlock
```

No context for debugging. No way to detect partial failures.

**Impact:** Silent failures are indistinguishable from crashes.

### 6. No Test Coverage for Concurrency (LOW)
**File:** `test/ledger.test.js`

The only test checks that a string exists in source code:
```javascript
assert.ok(src.includes('insufficient funds'));
```

No actual transfer tests, no concurrent scenarios, no ledger reconciliation.

**Impact:** Race conditions are undetectable in CI.

## What Must Be Fixed Before Increasing Volume

### Immediate (Blocking)
1. **Wrap all transfers in a database transaction** (BEGIN / COMMIT / ROLLBACK)
2. **Use SELECT ... FOR UPDATE to lock the source account** before reading balance
3. **Perform balance check inside the transaction** after acquiring the lock
4. **Add input validation** for both account IDs and amount

### Short-term (High Priority)
1. Add error handling with rollback on failure
2. Add integration tests with concurrent transfers
3. Add ledger reconciliation tests (sum of entries = balance deltas)
4. Add structured logging for audit trail

### Verification Required
Before any transfer volume increase:
- [ ] Concurrent transfer test with 100+ simultaneous operations
- [ ] Ledger reconciliation test verifying sum invariant
- [ ] Overdraft prevention test confirming insufficient funds blocks concurrent attempts
- [ ] Failure injection test (simulate DB connection loss mid-transfer)

## Risk Assessment by Scenario

| Transfer Volume | Current Risk | With Fixes |
|---|---|---|
| Low (< 1/sec) | Rare race conditions, auditable in reconciliation | Safe |
| Medium (1-10/sec) | Frequent race conditions, reconciliation delays | Safe |
| High (10-100/sec) | Daily overdrafts, broken reconciliation | Requires transaction isolation level tuning |

## Conclusion

The ledger violates the double-entry bookkeeping principle stated in README.md. The implementation is not safe for volume increase without architectural changes to enforce atomicity and concurrency control. Do not scale until these are addressed.
