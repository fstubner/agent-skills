# Wallet Ledger Assessment

## Executive Summary

**Status:** Not ready for increased transfer volume.

The current implementation has three critical issues that violate financial system requirements:
1. **Race condition on balance check** — concurrent transfers can bypass insufficient-funds checks
2. **Non-atomic operations** — transfers can partially complete, breaking ledger-balance reconciliation invariant
3. **Missing input validation** — no checks for negative amounts, account existence, or self-transfers

These defects will cause ledger inconsistencies under load and make reconciliation impossible.

---

## Critical Issues

### 1. Race Condition on Balance Check (Severity: Critical)

**Location:** `ledger.js:8-10`

**Problem:**
```javascript
const balance = await balanceMinor(fromId);
if (balance < amountMinor) return { ok: false, reason: 'insufficient funds' };

// <-- Another concurrent transfer could debit here
await query('UPDATE accounts SET balance_minor = balance_minor - $1 WHERE id = $2', [amountMinor, fromId]);
```

The balance is checked without any lock. Between the read and the debit, another concurrent request could execute against the same account, causing multiple transfers to succeed despite insufficient balance.

**Impact:** Account balance can go deeply negative. Finance reconciliation fails.

**Required fix:** Use database-level concurrency control (e.g., `SELECT ... FOR UPDATE` with transaction isolation).

---

### 2. Non-Atomic Operations (Severity: Critical)

**Location:** `ledger.js:12-17`

**Problem:**
The three operations (debit source, credit destination, insert ledger entry) are not wrapped in a single transaction:
```javascript
await query('UPDATE accounts SET balance_minor = balance_minor - $1 WHERE id = $2', ...);
await query('UPDATE accounts SET balance_minor = balance_minor + $1 WHERE id = $2', ...);
await query('INSERT INTO ledger_entries (from_id, to_id, amount_minor) VALUES ...', ...);
```

If any operation fails (network timeout, database constraint, duplicate key error), the ledger and balances become inconsistent. For example:
- Debit succeeds
- Credit succeeds
- Ledger insert fails → balances moved but no record of movement

**Impact:** Ledger sum ≠ balance difference. Reconciliation becomes impossible. Unrecoverable state.

**Required fix:** Wrap all three operations in a database transaction. Ensure atomicity.

---

### 3. Missing Input Validation (Severity: High)

**Location:** `ledger.js:8`

**Problems:**
- No validation that `amountMinor > 0` (negative or zero transfers allowed)
- No validation that `fromId !== toId` (self-transfers allowed, misleading ledger)
- No pre-check that both accounts exist before attempting operations (fails late, potentially after partial updates)

**Impact:** Ledger contains nonsensical entries. Silent failure modes.

**Required fix:** Validate inputs at the trust boundary before any database operations.

---

## Reconciliation Guarantee

The README states: *"The ledger is the source of truth for reconciliation: the sum of entries must always equal the difference between the account balances."*

This invariant is currently violated by:
- Race condition: allows balance < sum of debits
- Non-atomic operations: ledger entry may not exist for executed balance change
- No validation: permits invalid transfers that confuse reconciliation

Increasing transfer volume will expose these defects under concurrent load, making the system unreconcilable.

---

## Verification Performed

✓ Code review of `transfer()` function logic  
✓ Test suite passes (basic static check only)  
✓ Identified race condition window between balance read and debit  
✓ Identified atomicity gap across three separate queries  
✓ Verified no transaction wrapper or locking mechanism present  
✓ Confirmed input validation is absent  

---

## Recommendation

**Do not increase transfer volume.** Implement the fixes above before deploying to production:

1. Wrap transfer logic in a database transaction (BEGIN / COMMIT)
2. Use `SELECT balance_minor FROM accounts WHERE id = $1 FOR UPDATE` to lock rows
3. Add input validation: amount > 0, fromId ≠ toId, verify accounts exist
4. Add integration tests that simulate concurrent transfers and verify reconciliation invariant

Once these are in place, run a load test to confirm the ledger-balance invariant holds under concurrent load before increasing volume.
