# Release Review: Inventory Export CLI

**Status**: ❌ NOT READY FOR RELEASE

## Critical Finding: Zero-Count Items Excluded from Export

### Requirement Violation
The product specification (PRODUCT.md) explicitly requires:
- MVP: "Emit one `sku,count` row for every item, **including items with a zero count**."

### Current Behavior
The `toCsv()` function in `src/report.js` filters out items with zero counts:
```javascript
.filter((item) => item.count)
```

This uses a truthy check, which excludes any item where `count === 0` (a falsy value).

### Impact
When running the CLI on `sample-zero.json` (which contains `{"sku":"EMPTY-BIN","count":0}`), the export output would be:
```
sku,count
FULL-BIN,4
```

However, the correct output should include both items:
```
sku,count
EMPTY-BIN,0
FULL-BIN,4
```

### Test Coverage Gap
The existing test in `test/report.test.js` only covers positive counts and does not test the zero-count requirement, allowing the bug to remain undetected.

## Verification Summary
- ✓ CLI entry point structure is correct (src/cli.js)
- ✓ JSON input parsing works as expected
- ✓ CSV output format is correct for non-zero items
- ✗ **Zero-count items are excluded from output (violates MVP)**
- ✗ Test suite lacks zero-count scenario coverage

## Release Verdict
This release fails the core MVP requirement of exporting items with zero counts. The issue must be fixed before release.
