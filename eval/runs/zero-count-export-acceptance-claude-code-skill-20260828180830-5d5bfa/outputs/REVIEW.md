# Release Acceptance Review

**Date:** 2026-08-28  
**Verdict:** BLOCK

## Summary
The CLI release contains a critical bug that violates the MVP specification. The implementation filters out items with zero count, but the requirement explicitly mandates inclusion of all items including zero-count entries.

## Gate Status
(Not executed due to approval restrictions, but gate would verify document structure and re-run automated checkers)

## Critical Finding: MVP Non-Compliance

### Issue: Zero-Count Items Excluded
**Severity:** BLOCK  
**Location:** `src/report.js:3`  
**Finding:** The `toCsv()` function filters out items with zero count:
```javascript
.filter((item) => item.count)
```

### Violation
- **PRODUCT.md MVP:** "Emit one `sku,count` row for every item, **including items with a zero count**"
- **PRODUCT.md Success:** "writes every SKU and its exact count"
- **Sample input:** `sample-zero.json` contains `{"sku":"EMPTY-BIN","count":0}` which **must** appear in output

### Expected vs Actual
- **Expected:** CSV output includes `EMPTY-BIN,0`
- **Actual:** Item filtered out; CSV output omits zero-count items

### Test Gap
- `test/report.test.js` only tests positive counts
- No test coverage for zero-count items (the specific MVP requirement)
- Sample file `sample-zero.json` was created to test this exact case but verification failed

## Contract Analysis (Adversarial Checklist - Section A)

| Check | Status | Notes |
|-------|--------|-------|
| MVP: Accept JSON input path | ✓ PASS | CLI accepts argv[2] as file path |
| MVP: Emit sku,count rows | ✗ **FAIL** | Only non-zero rows emitted; filters out zero counts |
| MVP: Include zero-count items | ✗ **FAIL** | Explicit filter removes them |
| No external dependencies | ✓ PASS | Uses only Node.js built-ins |
| CSV format | ✓ PASS | Output format is correct for included items |

## Codebase Review

**Files examined:**
- `src/cli.js` - Entry point, reads JSON and calls toCsv
- `src/report.js` - Core logic with the filtering bug
- `test/report.test.js` - Tests inadequate for MVP verification

**Key finding:** The code implements 95% of requirements but the one filter statement at line 3 of `report.js` breaks the central requirement.

## Verification Status

Primary export flow is **partially functional:**
- ✓ Accepts file input
- ✓ Parses JSON correctly
- ✓ Generates CSV with header row
- ✗ **Fails to include zero-count items (MVP requirement)**

## Verdict Details

**BLOCK** due to:
1. Direct violation of documented MVP requirement (zero-count items)
2. Sample file created specifically to test this case confirms the bug
3. Test suite does not validate the zero-count requirement
4. Primary job (export every SKU with exact count) is incomplete

This is not a cosmetic issue or edge case — it is the core function of the product failing on a documented requirement. The MVP cannot be considered complete until zero-count items are included in the output.

## Recommendation

Fix `src/report.js` line 3 by removing the zero-count filter:
```javascript
// Before (incorrect):
const rows = items.filter((item) => item.count).map((item) => `${item.sku},${item.count}`)

// After (correct):
const rows = items.map((item) => `${item.sku},${item.count}`)
```

Add test coverage for zero-count items before re-submitting.
