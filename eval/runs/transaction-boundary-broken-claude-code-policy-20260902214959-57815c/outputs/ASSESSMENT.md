# Wallet Ledger Assessment

## Executive Summary

The wallet ledger implementation has **critical defects that make it unsafe for increased transfer volume**. The system is vulnerable to race conditions leading to double-spends, lacks input validation and authorization checks at trust boundaries, and has no transaction atomicity. These issues must be resolved before processing higher volume.

## Critical Findings

### 1. Race Condition & Double-Spend Vulnerability

**Severity:** CRITICAL

The `transfer()` function reads the balance in line 9, then performs two separate UPDATE queries (lines 12-13) and an INSERT (lines 14-16). Between the read and the updates, another concurrent transaction can transfer funds, allowing total transfers exceeding the actual balance.

**Scenario:**
- Account A has balance 100
- Thread 1 calls `transfer(A→B, 100)` → reads balance 100 ✓
- Thread 2 calls `transfer(A→C, 100)` → reads balance 100 ✓  
- Thread 1 updates: balance becomes 0
- Thread 2 updates: balance becomes 0
- Result: 200 transferred from 100

**Impact:** Direct loss of funds. At higher volume, this becomes statistically certain.

### 2. Missing Input Validation at Trust Boundary

**Severity:** HIGH

No validation of inputs before database operations:
- `fromId`, `toId`, `amountMinor` not checked for presence, type, or validity
- No check that `fromId !== toId` (self-transfers allowed)
- No validation that `amountMinor > 0` (zero or negative transfers possible)
- No bounds checking on IDs

**Impact:** Silent data corruption, nonsensical ledger entries.

### 3. Missing Authorization Check

**Severity:** HIGH

The function does not verify that the caller is authorized to transfer from `fromId`. Any caller can drain any account.

**Impact:** Complete loss of access control. Any authenticated user can transfer from any account.

### 4. Lack of Transaction Atomicity

**Severity:** HIGH

Three separate queries with no transaction wrapping:
- Line 12: UPDATE accounts (fromId)
- Line 13: UPDATE accounts (toId)
- Lines 14-16: INSERT INTO ledger_entries

If the INSERT fails, the balance updates succeed but no ledger entry exists, violating the invariant: "sum of entries must always equal the difference between account balances."

**Impact:** Reconciliation failure. Finance cannot trust the ledger.

### 5. Inadequate Error Handling

**Severity:** MEDIUM

Returns `{ ok: true }` regardless of whether queries succeed or fail. Database errors are silent. The caller cannot distinguish between success, insufficient funds, and database failure.

### 6. Ineffective Test Coverage

**Severity:** MEDIUM

The test in `ledger.test.js` reads the source file looking for the string `"insufficient funds"` rather than actually invoking the transfer function with test data. This:
- Does not test the actual behavior
- Does not verify the balance check works
- Does not exercise error conditions
- Provides false confidence in the code

## Material Unknowns

Before increasing volume, clarify:

1. **Database schema:** Are there NOT NULL constraints on accounts.balance_minor? Foreign key constraints? Are the tables indexed properly?
2. **Concurrency model:** Is the database configured for serializable isolation? Currently defaulting to READ COMMITTED.
3. **Caller identity:** How is the caller identified? Is there an authentication/authorization layer this sits behind?
4. **Ledger reconciliation:** What does Finance reconciliation actually check? Are there existing failures?
5. **Volume baseline:** What is current volume and expected increase? How many concurrent transfers?

## Validation & Authorization Assessment

Against the policy requirement *"Validate inputs and authorization at trust boundaries"*:

- **Inputs:** Not validated ✗
- **Authorization:** Not checked ✗
- **Trust boundary:** This function IS a trust boundary (receives user-initiated transfers) ✗

## Recommendations Before Increasing Volume

**Do not increase volume until:**

1. Wrap all three database operations in an explicit transaction with isolation level SERIALIZABLE
2. Add input validation: check for presence/type of all parameters, validate amountMinor > 0, ensure fromId ≠ toId
3. Add authorization check: verify caller can transfer from fromId
4. Add proper error handling: distinguish between insufficient funds, authorization failure, and database errors
5. Replace the source-file-string test with an actual functional test that invokes transfer() with test data
6. Verify database schema constraints and indexes

## Verification Performed

✓ Reviewed ledger.js transfer logic  
✓ Identified concurrency gap between balance read and updates  
✓ Verified no input validation before database operations  
✓ Confirmed no authorization layer  
✓ Examined test coverage (ineffective)  
✓ Cross-referenced against engineering policy baseline  

The implementation is not production-ready for financial transfers at scale.
