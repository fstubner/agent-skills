# Release Review — inventory-export CLI

**Verdict: BLOCK**

## Review Context

- **Acceptor independence**: Separate context (independent review)
- **Runtime verified**: No (code-only analysis; cannot execute due to permission constraints, but issue is evident from static analysis)
- **Scope**: Full codebase review (no prior acceptance to build on)
- **Gate status**: Not run (automation unavailable in this context)

This review is based on:
1. Static code analysis against PRODUCT.md requirements
2. Test coverage assessment
3. Adversarial checklist for CLI boundary conditions
4. No automated gate execution (blocked by permission requirements)

## Critical Findings

### 1. MVP Requirement Violation — BLOCKS RELEASE

**Location**: `src/report.js:3`

```javascript
.filter((item) => item.count)
```

**Finding**: The implementation filters out items where `count` is falsy, which removes any item with a count of 0. This violates the explicit MVP requirement:

From `PRODUCT.md` MVP:
> "Emit one `sku,count` row for **every item, including items with a zero count**."

**Failure scenario**:
- Input: `{"items":[{"sku":"EMPTY-BIN","count":0},{"sku":"FULL-BIN","count":4}]}`
- Expected output:
  ```
  sku,count
  EMPTY-BIN,0
  FULL-BIN,4
  ```
- Actual output:
  ```
  sku,count
  FULL-BIN,4
  ```
- The EMPTY-BIN item is silently dropped, failing the primary job of the product.

**Why it matters**: Zero-count items are operationally significant in inventory reconciliation (they represent bins that should be empty). Dropping them breaks the contract with downstream systems expecting complete inventory data.

### 2. Test Coverage Gap — BLOCKS RELEASE

**Location**: `test/report.test.js`

The sole test verifies positive counts only:
```javascript
test('exports positive counts', () => {
  assert.equal(toCsv([{ sku: 'A-1', count: 3 }]), 'sku,count\nA-1,3');
});
```

**Finding**: No test verifies that zero-count items are included. The `sample-zero.json` exists with a zero-count item but is never used in test coverage. A test checking the critical requirement would have caught this:

Missing test:
```javascript
test('exports zero counts', () => {
  assert.equal(
    toCsv([{ sku: 'EMPTY-BIN', count: 0 }]),
    'sku,count\nEMPTY-BIN,0'
  );
});
```

---

## Contract Compliance

**PRODUCT.md Success**: "Running the CLI on a JSON inventory file writes every SKU and its exact count."

- ❌ **FAILS** — CLI does not write every SKU (omits zero-count SKUs)

**PRODUCT.md MVP Checklist**:
- ❌ Accept a JSON input path — ✓ Implemented
- ❌ Emit one `sku,count` row for every item, **including items with a zero count** — ✗ NOT implemented (zero counts filtered out)

---

## Adversarial Checklist — Relevant Sections

### A — Contract
- **Success condition**: Attempting to export inventory with zero-count items fails (zero-counts omitted)
- **MVP completeness**: Primary requirement (zero-count inclusion) not met

### C — Boundary conditions
- **Empty counts**: Not handled correctly (filtered out instead of exported)
- **Garbage input**: No validation of missing `count` fields (would also be falsy and filtered)

---

## Code Quality Observations (Non-blocking)

**Good**:
- Clean, minimal code with no external dependencies (meets constraint)
- Entry point correctly reads file and invokes report function
- CSV header format correct

**Observations**:
- The filter logic suggests the implementer may have misunderstood the requirement as "export non-empty items"
- `process.argv[2]` assumes file path argument without validation or error handling (acceptable for a simple CLI; not a blocker)

---

## Verification Coverage

**What was checked**:
1. ✓ Code analysis: `toCsv` filter implementation vs. PRODUCT.md MVP
2. ✓ Requirement traceability: MVP requirement "including items with a zero count" found and verified
3. ✓ Test coverage: Only positive-count test present; zero-count test absent
4. ✓ Sample data: `sample-zero.json` confirms the scenario exists

**What was not checked** (due to execution constraints):
- Runtime execution: Cannot run `node src/cli.js sample-zero.json` to observe actual output
- Automated gate checks: `accept-check.js` blocked by permission requirements
- Edge cases: Malformed JSON, missing fields (requires runtime testing)

The blocking issue (zero-count filtering) is deterministic and evident from code inspection; runtime verification would only confirm what the code already shows.

---

## Verdict Summary

**BLOCK — Do not release.**

The implementation violates an explicit MVP requirement: it filters out zero-count items instead of including them. This is a primary-job failure per the acceptance criteria ("any primary-path failure → BLOCK"). No product documentation, test coverage, or adversarial checklist can paper over this gap.

**To unblock**:
1. Remove the `.filter((item) => item.count)` condition or replace with a check that keeps all items
2. Add test coverage for zero-count items (e.g., `test('exports zero counts')`)
3. Verify with sample data that `EMPTY-BIN,0` appears in output

All other aspects (code quality, architecture, constraints) are acceptable.
