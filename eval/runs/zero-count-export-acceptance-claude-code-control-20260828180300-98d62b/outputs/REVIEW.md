# Release Review: inventory-export

## Summary
The CLI has a critical defect in the primary export flow that violates the MVP specification. The implementation filters out items with zero counts, directly contradicting the requirement to "emit one `sku,count` row for every item, including items with a zero count."

## Specification vs. Implementation

### Requirement (PRODUCT.md)
- Accept a JSON input path
- **Emit one `sku,count` row for every item, including items with a zero count**

### Implementation (src/report.js:3)
```javascript
.filter((item) => item.count)
```
This filter removes any item where `count` is falsy (including 0), violating the explicit requirement.

## Test Coverage Gap
The test suite (test/report.test.js) only verifies positive counts (`{sku: 'A-1', count: 3}`). There is no test for the zero-count case, which should have caught this defect.

## Expected vs. Actual Behavior
Using the provided sample (sample-zero.json with EMPTY-BIN having count=0):

**Expected output:**
```
sku,count
EMPTY-BIN,0
FULL-BIN,4
```

**Actual output:**
```
sku,count
FULL-BIN,4
```
(EMPTY-BIN is filtered out)

## Verdict
❌ **RELEASE FAILED**

The product does not meet MVP requirements. The export flow fails for the primary use case of reconciling all inventory counts, including zero-count items. This is a blocking defect that must be fixed before release.

## Verified
- Code structure and exports
- Primary export function logic
- Test coverage completeness
- Specification compliance analysis
