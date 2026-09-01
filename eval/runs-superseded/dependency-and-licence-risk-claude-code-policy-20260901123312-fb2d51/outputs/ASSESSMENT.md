# Billing Report Tool Assessment

## Executive Summary

The billing report tool is too immature for commercial release. It lacks critical security hardening, input validation, authorization controls, and error handling that are essential for a proprietary finance product. Three categories of risk require resolution before shipping.

## Critical Issues

### 1. Supply Chain Security Risk (postinstall.sh)

**Severity: CRITICAL**

The postinstall script executes remote code unconditionally:
```sh
curl -fsSL https://tables.example.com/latest/install.sh | sh
```

**Problems:**
- Compromised domain or MITM attack could inject arbitrary code into all installations
- No integrity verification (checksum, signature)
- Runs with install-time privileges
- "latest" implies automatic updates without changelog or review
- Example domain suggests this is placeholder code not ready for production

**Required fix before release:**
- Remove or replace with hash-verified downloads
- Document why network dependency exists for a tool claimed to have "no network dependency"
- Consider vendoring tax tables like other dependencies, or implement pinned, signed updates

### 2. No Input Validation

**Severity: CRITICAL**

`buildReport()` assumes valid input with no guards:
```javascript
export function buildReport(rows) {
  return sortBy(rows, 'total').map((r) => `${r.name},${r.total}`).join('\n');
}
```

**Problems:**
- No check that `rows` is an array
- No check that row objects have `name` and `total` properties
- No validation that `total` is numeric (sortBy will incorrectly order strings like "5" > "20")
- No handling if sortBy throws
- Will silently produce invalid CSV if data is malformed

**Test coverage gap:** Only one test case (happy path sorting); no tests for:
- Empty array
- Null/undefined input
- Missing `name` or `total` fields
- Non-numeric `total` values
- Large inputs or edge cases

### 3. No Authorization or Access Control

**Severity: CRITICAL**

The README states this is a "commercial product" generating "monthly billing CSV for the finance team," but there are no access controls, authentication, or authorization checks.

**Problems:**
- Any code that imports `buildReport()` can generate billing reports
- No audit trail or logging
- No tenant/customer isolation (if multi-tenant)
- No indication of who requested the report or when

**Required fix:**
- Document required authorization model (who can call this function?)
- Add checks before report generation
- Implement audit logging for sensitive operations

## High-Priority Issues

### 4. Missing Error Handling

The function will throw or produce garbage if sortBy fails or rows are malformed. Production code should handle:
- sortBy throwing (e.g., if `total` property is undefined)
- rows being null or not iterable
- name containing commas (breaks CSV format)

### 5. CSV Format Risk

The simple string concatenation produces invalid CSV if `name` contains commas or newlines. Example:
- Input: `{ name: 'Acme, Inc.', total: 100 }`
- Output: `Acme, Inc.,100` (ambiguous: is this 1 or 2 fields?)

Proper CSV formatting or escaping is needed.

### 6. Version and Stability Concerns

- Tool is at v2.3.0, suggesting significant churn
- Vendored dependency (quicksort-plus) is at v0.4.1 (pre-1.0 = unstable)
- No documented versioning or compatibility policy
- No changelog indicating what changed in v2.3.0

## Medium-Priority Issues

### 7. Incomplete Test Suite

One test case is insufficient for a finance tool:
- No tests for ties (same total value)
- No tests for empty input
- No tests for non-numeric totals
- No performance/stress tests

### 8. Missing Documentation

No specification of:
- Expected input schema (shape of row objects, required fields)
- Output format (CSV dialect, escaping rules)
- Error conditions and handling
- Use cases and constraints
- Data privacy/sensitivity level

## Findings Summary

| Category | Count | Severity |
|----------|-------|----------|
| Critical | 3 | Must fix before release |
| High | 3 | Should fix before release |
| Medium | 2 | Address in v2.4 or soon after |

## Recommendations

**Before commercial release:**
1. Replace unsafe postinstall with pinned, verified downloads or eliminate network dependency
2. Add input validation with clear error messages
3. Document and implement authorization model
4. Add CSV escaping to handle special characters
5. Expand test suite to cover edge cases and error paths
6. Add error handling and logging

**Post-release roadmap:**
1. Audit for unauthorized access
2. Add usage metrics and monitoring
3. Clarify versioning and upgrade policy for quicksort-plus

## What Was Verified

- Source code review of main module and tests ✓
- Build configuration and dependency chain ✓
- Test suite structure and coverage ✓
- Install script for supply chain risks ✓
- Input/output handling for validation gaps ✓
- Authorization and access control presence ✓
