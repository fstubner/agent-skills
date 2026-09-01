# Release Acceptance Review

**Status: BLOCK**

**Date:** 2026-08-28  
**Reviewer Context:** Independent review (separate from build)  
**Acceptance Gate:** Not executed (requires bash approval)  
**Runtime Verification:** Could not perform (requires bash approval to execute CLI)

## Finding Summary

### Critical Blocker: Zero-Count Items Are Filtered Out

**File:** `src/report.js`, line 3  
**Severity:** BLOCK (MVP requirement violation)

The `toCsv()` function contains:
```javascript
.filter((item) => item.count)
```

This filter removes any item where `count` is falsy, which includes items with a count of 0.

**Requirement Violation:**  
- PRODUCT.md MVP states: "Emit one `sku,count` row for **every item, including items with a zero count**"
- Test data (sample-zero.json) includes: `{"sku":"EMPTY-BIN","count":0}`
- Expected behavior: Should output `EMPTY-BIN,0` in the CSV
- Actual behavior: Zero-count items are silently omitted from output

**Test Gap:**  
- `test/report.test.js` only validates positive counts
- No test case covers zero-count items, missing the MVP acceptance criterion

### Secondary Concern: Missing Input Validation

**File:** `src/cli.js`  
**Severity:** CONDITIONAL (affects robustness)

The CLI assumes:
- Input file is valid JSON
- JSON has an `items` array
- All items have `sku` and `count` properties

No error handling for:
- Missing or malformed JSON
- Missing `items` key
- Incomplete item objects
- Null/undefined sku values

While the MVP does not explicitly require validation, the absence of error messages on invalid input means users get silent failures or crashes rather than actionable feedback.

## What Was Verified

1. **Code inspection:** Read all source files (src/cli.js, src/report.js, test/report.test.js)
2. **Requirement mapping:** Compared PRODUCT.md MVP against implementation
3. **Test coverage:** Reviewed test/report.test.js for zero-count coverage (found gap)
4. **Sample data:** Examined sample-zero.json which tests the failing case

## What Could Not Be Verified

- Runtime behavior via CLI execution (requires bash approval)
- Acceptance gate checks (requires bash approval to run node scripts)
- Full adversarial checklist items from product-acceptance workflow
  - Empty/error state handling on actual invocation
  - Garbage input behavior at runtime
  - Exact error messages and output formatting

## Recommendation

The zero-count filter bug must be fixed before this release ships. This is a direct MVP violation that makes the primary job incompletable for inventories with empty bins.

**Before next review:** Remove the `.filter((item) => item.count)` line to include all items regardless of count, and add a test case that validates zero-count items are exported.
