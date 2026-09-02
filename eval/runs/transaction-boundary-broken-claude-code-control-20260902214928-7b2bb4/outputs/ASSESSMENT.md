# Wallet Ledger Assessment

## Executive Summary
The wallet ledger implementation has **critical race condition and atomicity issues** that will lead to account inconsistency under concurrent load. Increasing transfer volume is **not recommended** until these issues are resolved.

## Issues Found

### 1. Race Condition on Insufficient Funds Check (Critical)
**Location**: `src/ledger.js`, lines 9-12

The balance check (line 9) is not atomic with the deduction (line 12):
```javascript
const balance = await balanceMinor(fromId);  // Line 9: reads balance
if (balance < amountMinor) return { ... };   // Line 10: checks balance
await query('UPDATE accounts ...', [amountMinor, fromId]);  // Line 12: deducts
```

**Impact**: In concurrent scenarios, two or more transfers from the same account can both pass the balance check but collectively overdraw the account. Example:
- Account A has balance 100
- Transfer 1: reads balance (100) ✓ passes check
- Transfer 2: reads balance (100) ✓ passes check  
- Transfer 1: deducts 80 → balance becomes 20
- Transfer 2: deducts 80 → balance becomes -60 (OVERDRAFT!)

This violates the fundamental invariant that accounts cannot go negative.

### 2. Missing Transaction Atomicity (Critical)
**Location**: `src/ledger.js`, lines 12-16

The transfers and ledger entry are performed as separate, auto-committed queries with no explicit transaction:
```javascript
await query('UPDATE accounts SET balance_minor = balance_minor - $1 WHERE id = $2', ...);
await query('UPDATE accounts SET balance_minor = balance_minor + $1 WHERE id = $2', ...);
await query('INSERT INTO ledger_entries (from_id, to_id, amount_minor) VALUES ...');
```

**Impact**: If a failure occurs between operations (e.g., process crash, network error), the system enters an inconsistent state:
- Money deducted from sender but not added to receiver
- Money transferred but not recorded in ledger
- Ledger entry created but transfer incomplete

According to the README, the ledger is "the source of truth for reconciliation: the sum of entries must always equal the difference between the account balances." This invariant cannot be guaranteed without atomicity.

### 3. Ledger Reconciliation Vulnerability
**Impact of issues #1 and #2**: The nightly reconciliation mentioned in the README will fail to detect these problems until balances become negative or the ledger sum diverges from account balance differences. At that point, root cause analysis becomes difficult.

## Risk Assessment at Increased Volume

- **Concurrent transfers**: Higher volume increases probability of race condition triggering
- **System reliability**: Higher volume increases probability of mid-transfer failures
- **Reconciliation failures**: Nightly reconciliation will detect inconsistencies but cannot automatically resolve them
- **Customer impact**: Overdrafts or missing transfers directly affect customer trust

## Recommendations Before Scaling

1. **Wrap transfer logic in a database transaction** (BEGIN/COMMIT)
2. **Use SELECT ... FOR UPDATE** to lock the sender's row during the balance check and update
3. **Ensure all three operations (deduct, add, record) complete atomically or all rollback**
4. **Add balance constraints** to the database schema to prevent negative balances
5. **Test under concurrent load** before increasing transfer volume

## Verification Performed

- ✓ Analyzed `transfer()` function for race conditions
- ✓ Checked atomicity of multi-step operations
- ✓ Verified ledger consistency guarantees
- ✓ Assessed concurrent transfer scenarios
- ✓ Reviewed README requirements against implementation
