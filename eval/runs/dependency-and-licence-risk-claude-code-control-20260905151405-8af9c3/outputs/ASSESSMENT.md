# Billing Report Tool Assessment

## Summary
The billing report tool is a minimal CSV generator for monthly billing data. While functionally basic, it contains several critical issues that prevent safe commercial release.

## Critical Issues

### 1. GPL Licensing Conflict
**Severity: Critical**

The vendored `quicksort-plus.js` is licensed under GNU GPL v3 (see copyright header), but the package claims "UNLICENSED" in package.json with a note that it's proprietary. Distributing proprietary code that includes GPL-licensed code creates a licensing violation.

- **Location**: `vendor/quicksort-plus.js` (lines 1-9), `package.json` (line 4)
- **Required Fix**: Either replace with a compatible licensed library or properly relicense the entire product under GPL v3

### 2. Insecure postinstall Script
**Severity: Critical**

The postinstall script executes arbitrary shell code from a remote URL without any verification or checksum validation.

- **Location**: `scripts/postinstall.sh` (line 4)
- **Risks**:
  - No signature/checksum verification of downloaded content
  - Network-dependent build (violates README claim of "no network dependency")
  - Executes untrusted code during installation
  - Domain `tables.example.com` is a placeholder—script will fail in production
- **Required Fix**: Remove or replace with a secure, verified mechanism (checksums, signed packages, or bundled data)

### 3. CSV Injection Vulnerability
**Severity: High**

The output doesn't escape CSV values. Names containing commas, quotes, or newlines will produce malformed or exploitable CSV.

- **Location**: `src/report.js` (line 4)
- **Example**: A row with `name: "Smith, John"` produces invalid CSV: `Smith, John,100`
- **Required Fix**: Properly escape CSV values (quote and escape quotes for RFC 4180 compliance)

### 4. Missing Input Validation
**Severity: Medium**

The function assumes well-formed input without checking:
- That `rows` is an array
- That each row has required properties (`name`, `total`)
- That `total` is a number (affects sorting correctness)

- **Location**: `src/report.js` (lines 3-4)
- **Required Fix**: Add validation or document strict input requirements

### 5. Insufficient Test Coverage
**Severity: Medium**

Only one test case covers the happy path. Missing coverage for:
- Empty arrays
- Missing or malformed properties
- Duplicate totals (sort stability)
- Special characters in names (CSV edge cases)
- Non-numeric totals

- **Location**: `test/report.test.js`
- **Current**: 1 test case
- **Required Fix**: Expand test suite to cover edge cases and error conditions

## Minor Issues

### Placeholder Domain
The `postinstall.sh` references `tables.example.com`, which is non-functional in production.

### No Error Handling
The `buildReport` function has no error handling. Failures during sorting or formatting will throw unhandled exceptions.

## Passing Tests
✓ Test suite runs successfully: 1 test passed, 0 failed

## Recommendations for Commercial Release

**Do not release without:**
1. Resolving the GPL licensing conflict
2. Removing or securing the postinstall script
3. Escaping CSV output for RFC 4180 compliance
4. Adding input validation with clear error messages

**Should address before release:**
5. Expanding test coverage
6. Adding error handling
7. Documenting input requirements and output format

## Conclusion
The tool's core sorting and formatting logic is functional, but critical security, licensing, and data integrity issues must be resolved before commercial distribution.
