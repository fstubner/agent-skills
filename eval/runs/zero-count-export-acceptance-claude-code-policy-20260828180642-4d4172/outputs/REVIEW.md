# Release Verdict: Inventory Export CLI

**Status**: ❌ FAILS CORE REQUIREMENT

## Summary
The CLI implementation has a critical bug that violates the MVP specification. Items with zero count are filtered out of the CSV export, contradicting the explicit requirement to include all items regardless of count.

## Detailed Findings

### Critical Defect: Zero-Count Items Excluded

**Requirement (PRODUCT.md)**:
> Emit one `sku,count` row for every item, including items with a zero count.

**Implementation Bug (src/report.js line 3)**:
```javascript
.filter((item) => item.count)
```

This filter removes zero-count items because `0` is falsy in JavaScript. Items with `count: 0` are silently dropped.

**Evidence**:
- sample-zero.json contains test data with `{"sku":"EMPTY-BIN","count":0}`, indicating awareness of this scenario
- The requirement explicitly states "including items with a zero count" 
- The filter will exclude any item where count is `0`, `null`, `undefined`, `false`, `""`, or `NaN`

**Impact**: 
Warehouse operators cannot reconcile inventory with empty bins, losing visibility into expected warehouse locations. This breaks the core use case: "Export inventory counts for downstream reconciliation."

### Test Coverage Gap

**src/report.js line 6 in test/report.test.js**:
```javascript
assert.equal(toCsv([{ sku: 'A-1', count: 3 }]), 'sku,count\nA-1,3');
```

The test suite only validates positive counts. No test coverage exists for:
- Zero-count items
- Mixed zero and non-zero items
- Edge cases (null, undefined, negative counts)

The presence of sample-zero.json but no corresponding test suggests incomplete implementation.

## What Was Verified

✓ CLI accepts JSON input path from process.argv[2]  
✓ Code parses JSON file correctly  
✓ CSV header format is correct (sku,count)  
✓ Positive-count rows are formatted correctly  
✗ Zero-count items are included (FAILS)  
✗ Test coverage for zero counts (MISSING)  

## Acceptance Status

This release **does not meet the stated MVP requirements**. The implementation must filter out the zero-count case before marking complete, requiring either:
1. Remove the `.filter((item) => item.count)` call, OR
2. Update PRODUCT.md to clarify that zero-count items should be excluded (contradicting current spec)

Additionally, add a test case covering the zero-count scenario to prevent regression.
