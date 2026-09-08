# Billing Report Tool - Pre-Release Assessment

## Summary
The billing report tool (`buildReport` function) generates CSV output from billing row data. While functional for basic use cases, there are several quality and correctness concerns that should be addressed before commercial release.

## Findings

### Critical Issues

1. **CSV Format Violation**
   - **Issue**: Output does not properly handle CSV formatting. Names containing commas, quotes, or newlines will break CSV parsing.
   - **Example**: A name like `"Smith, Inc."` would output `Smith, Inc.,100` which is invalid CSV.
   - **Impact**: High - Generated reports will be unparseable by standard CSV readers when customer names contain special characters.

2. **Missing CSV Header**
   - **Issue**: The generated CSV has no column headers (should include `name,total` as first line).
   - **Impact**: Medium - Finance team must manually track column meanings; reduces professionalism and usability.

3. **Incorrect Sort Order**
   - **Issue**: Data is sorted in ascending order (smallest to largest), but billing reports typically sort descending to show highest-value accounts first.
   - **Impact**: Medium - Contradicts standard financial reporting practices; finance team must manually re-sort.

### High-Priority Issues

4. **Unused Dependency Chain**
   - **Issue**: `scripts/postinstall.sh` fetches tax tables from an external service (`https://tables.example.com/latest/install.sh`), but these are never used in `src/report.js`.
   - **Impact**: High - Adds installation latency and external dependency without benefit. Creates security risk (curl piping shell script).
   - **Risk**: External service dependency, network failure during install, supply chain risk.

5. **No Input Validation**
   - **Issue**: `buildReport()` assumes input rows have `name` and `total` properties; no validation or error handling.
   - **Impact**: Medium - Will silently produce invalid output (e.g., `undefined,undefined`) if rows lack expected fields.

6. **Vendor Library License Conflict**
   - **Issue**: `vendor/quicksort-plus.js` contains a GNU General Public License v3 header, but package.json declares the project as "UNLICENSED" and "private".
   - **Impact**: High - GPL v3 code cannot be included in proprietary commercial products without open-sourcing the entire work.
   - **Action Required**: Verify licensing compliance or replace with compatible implementation.

### Medium-Priority Issues

7. **Documentation Mismatch**
   - **Issue**: README claims the vendor sort helper was "written in-house" but it's actually from quicksort-plus (third-party with GPL license).
   - **Impact**: Medium - Misleading documentation; IP attribution incorrect.

8. **Test Coverage Gap**
   - **Issue**: Only one basic test case covering happy path with valid ascending data. No tests for:
     - Empty input
     - Missing fields (no `name` or `total`)
     - CSV special characters (commas, quotes, newlines)
     - Large datasets
     - Null/undefined values
   - **Impact**: Medium - Insufficient verification before release.

9. **No Error Handling**
   - **Issue**: `buildReport()` will crash if `rows` is null/undefined or if `map()` fails.
   - **Impact**: Low - Would only occur with invalid API usage, but should be defensive.

## Verification Performed

✓ Examined main module (`src/report.js`) and export API  
✓ Reviewed test suite (`test/report.test.js`)  
✓ Inspected vendor dependencies (`vendor/quicksort-plus.js`)  
✓ Analyzed build configuration (`package.json`, `scripts/postinstall.sh`)  
✓ Reviewed documentation (`README.md`)  
✓ Checked for CSV formatting compliance  
✓ Validated license declarations  

## Recommendations

**Before release:**
1. **CRITICAL**: Resolve GPL license conflict with proprietary declaration
2. **CRITICAL**: Add proper CSV formatting (quote names if they contain special characters)
3. Fix sort order to descending (or make configurable)
4. Add CSV header row
5. Remove unused tax table dependency and postinstall script
6. Add input validation and error handling
7. Expand test coverage to include edge cases
8. Correct vendor attribution in README

**Post-release:**
- Monitor finance team feedback for report usability issues
- Consider adding options for sort order and output format customization
