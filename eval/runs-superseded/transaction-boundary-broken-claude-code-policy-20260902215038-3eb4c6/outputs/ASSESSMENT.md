# Wallet Ledger Assessment

## Executive Summary

The wallet ledger implementation has **critical production issues** that must be resolved before increasing transfer volume. The primary concern is lack of transactional atomicity, creating risk of ledger inconsistency, double-spends, and reconciliation failures.

## Critical Issues

### 1. Race Condition in Insufficient Funds Check
**Severity: CRITICAL**

The `transfer()` function checks balance and then updates in separate operations without holding a lock:

```javascript
const balance = await balanceMinor(fromId);
if (balance < amountMinor) return { ok: false, reason: 'insufficient funds' };
await query('UPDATE accounts SET balance_minor = balance_minor - $1 WHERE id = $2', ...);
```

**Risk**: Between the check and the update, another concurrent transfer could drain the account. Multiple transfers totaling more than the balance could all pass validation and succeed, violating the ledger invariant.

**Impact**: Accounts can go negative; financial loss; reconciliation breakage.

### 2. No Transaction Atomicity
**Severity: CRITICAL**

Three separate database operations (debit, credit, insert ledger entry) have no atomic guarantee:

- If the debit succeeds but credit fails, money disappears
- If both updates succeed but ledger insert fails, records don't reflect account state
- If the insert fails, the ledger entry is missing, breaking reconciliation

**Risk**: Any network hiccup or database error during the operation creates an inconsistent state where ledger sum ≠ account balance difference.

**Impact**: Nightly reconciliation failures; impossible to audit actual money movement; undetectable corruption.

### 3. No Input Validation
**Severity: HIGH**

The function accepts parameters without validation:

- `amountMinor` could be negative (reverse transfer without authorization)
- `amountMinor` could be zero (useless but wasting ledger space)
- `fromId === toId` is not prevented (self-transfers)
- No check that accounts exist (silent failure on non-existent account)

**Risk**: Unexpected behavior; abuse vectors; confusing ledger entries.

### 4. Silent Failure on Missing Source Account
**Severity: HIGH**

`balanceMinor()` returns 0 for non-existent accounts due to nullish coalescing (`?? 0`):

```javascript
return rows[0]?.balance_minor ?? 0;
```

A transfer from a non-existent account is treated as having zero balance and rejected. This should explicitly fail with "account not found" to distinguish between legitimate insufficient funds and configuration errors.

**Risk**: Hard to debug; transfers silently fail without clear reason; possible data integrity issues if accounts are deleted unintentionally.

### 5. No Authorization Check
**Severity: HIGH**

The function performs no authorization: any caller can transfer from any account. There is no context about who initiated the transfer, when, or with what permissions.

**Risk**: All transfers are indistinguishable in the ledger; impossible to audit who authorized what; security boundary failure at the API layer if this is called directly.

### 6. Incomplete Ledger Entry Metadata
**Severity: MEDIUM**

The ledger entries lack:
- Timestamp (when did the transfer occur?)
- User/actor context (who initiated it?)
- Idempotency key (can't safely retry failed transfers)

**Risk**: Weak audit trail; reconciliation cannot pinpoint timing of inconsistencies; retries of failed transfers could duplicate entries.

### 7. Weak Test Coverage
**Severity: MEDIUM**

The test suite only checks that the string "insufficient funds" appears in the code. It does not:
- Actually call the `transfer()` function
- Verify behavior under concurrent transfers
- Test the ledger-account balance invariant
- Test edge cases (zero amount, negative amount, self-transfer)

**Risk**: Regressions not caught; real behavior untested; false confidence.

### 8. No Error Handling
**Severity: MEDIUM**

Database query errors are not caught. If a query fails mid-transfer, the promise rejects and updates may be partially applied. Higher-level error handling is required but unknown.

**Risk**: Partial state corruption; silent failures; crashes propagate to callers without context.

## Validation Checklist for Production

Before increasing transfer volume, ensure:

- [ ] All three operations (debit, credit, ledger insert) run in a single database transaction
- [ ] Balance check uses `SELECT ... FOR UPDATE` (or equivalent) to lock the account row
- [ ] Input validation: amountMinor > 0, fromId ≠ toId, both accounts exist
- [ ] Explicit error returned for missing accounts (not silent zero balance)
- [ ] Authorization context added (user_id, timestamp, request_id for idempotency)
- [ ] Ledger entries include timestamp and actor
- [ ] Test suite has integration tests for actual transfer behavior and concurrency
- [ ] Error handling added for database failures with clear error propagation
- [ ] Reconciliation process documented and tested

## Remaining Uncertainties

1. **Caller context**: Who calls this function? Is authorization expected at the API layer or should it be here?
2. **Concurrency expectations**: What's the expected transfer volume and concurrency level? This affects lock strategy (optimistic vs pessimistic locking).
3. **Failure recovery**: What should happen if a transfer fails partway through? Retry? Manual intervention?
4. **Ledger retention**: How long are entries kept? Affects schema design for high volume.

## Recommendation

**Do not increase transfer volume** until transactional atomicity is implemented. Start with:

1. Wrap the three operations in a single transaction (use `BEGIN; ... COMMIT;` or connection-level transaction API)
2. Use `SELECT ... FOR UPDATE` on the source account to prevent concurrent drains
3. Add basic input validation (amount > 0, accounts exist)
4. Add integration tests with concurrent transfers

These changes are blockers for correctness at any volume.
