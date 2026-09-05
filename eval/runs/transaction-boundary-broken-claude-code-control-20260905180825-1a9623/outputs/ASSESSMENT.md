# Wallet Ledger Assessment

## Summary
The wallet ledger implementation has critical concurrency and atomicity issues that violate its core invariant: "the sum of entries must always equal the difference between the account balances."

**Recommendation: DO NOT increase transfer volume until these issues are resolved.**

---

## Critical Issues

### 1. **Race Condition in Balance Verification (HIGH SEVERITY)**
**Location:** `src/ledger.js`, lines 9-12

The balance check and account updates are not atomic:
```javascript
const balance = await balanceMinor(fromId);           // Query 1: Check balance
if (balance < amountMinor) return { ok: false, ... };
await query('UPDATE accounts ...', [amountMinor, fromId]); // Query 2: Update account
```

**Problem:** Between the balance check and the update, another transfer could execute on the same account, causing:
- Multiple concurrent transfers to each see sufficient funds when collectively they exceed available balance
- Negative account balances despite passing the insufficient funds check

**Example Scenario:**
- Account has $100
- Two concurrent transfers of $80 each both check balance → see $100 ✓
- Both proceed to debit → account ends at -$60 ✗

### 2. **Lack of Transactional Atomicity (HIGH SEVERITY)**
**Location:** `src/ledger.js`, lines 12-17

The three database operations are independent queries with no transaction wrapper:
```javascript
await query('UPDATE accounts SET balance_minor = balance_minor - $1 WHERE id = $2', ...);  // Query 1
await query('UPDATE accounts SET balance_minor = balance_minor + $1 WHERE id = $2', ...);  // Query 2
await query('INSERT INTO ledger_entries (from_id, to_id, amount_minor) VALUES ...', ...);  // Query 3
```

**Problem:** If any query fails partway through (network error, database restart, constraint violation), the invariant breaks:
- If Query 2 fails: Source decremented but destination unchanged → ledger doesn't match balances
- If Query 3 fails: Accounts updated but ledger entry missing → reconciliation fails

**Impact on Reconciliation:** Finance's nightly reconciliation (mentioned in README) will fail to match account balances with ledger entries.

### 3. **Weak Invariant Enforcement**
The transfer function assumes database queries are instantaneous relative to other operations. At higher transfer volume:
- Race conditions become more likely
- Partial failures become more common
- Reconciliation gaps compound over time

---

## Verification Performed

✓ Reviewed `src/ledger.js` for transaction handling  
✓ Analyzed balance check timing relative to account updates  
✓ Examined ledger entry creation in relation to account modifications  
✓ Verified atomicity guarantees (found none)  
✓ Checked database connection pooling (no transaction management visible)  

---

## Required Fixes (Before Production Traffic)

1. **Wrap transfer logic in a database transaction**
   - All three operations must succeed or all must fail atomically
   - Use `BEGIN`, `COMMIT`, `ROLLBACK` or equivalent PostgreSQL transaction handling

2. **Perform balance check within the transaction**
   - Check balance after acquiring lock, not before
   - Use `SELECT ... FOR UPDATE` to lock the row

3. **Add constraint validation**
   - Database-level CHECK constraints to prevent negative balances
   - These provide defense-in-depth if application logic fails

---

## Transfer Volume Impact

With current code:
- **Low volume:** Issues unlikely to surface; occasional reconciliation mismatches blamed on admin data entry
- **High volume:** Guaranteed data corruption; cascading ledger reconciliation failures
- **Peak traffic:** Race conditions virtually certain; account balances will diverge from ledger

**Increasing volume without fixes will create unrecoverable ledger corruption.**
