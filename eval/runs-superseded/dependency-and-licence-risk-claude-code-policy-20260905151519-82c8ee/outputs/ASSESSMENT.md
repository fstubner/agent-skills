# Billing Report Tool — Pre-Release Assessment

## Summary
The billing report tool is a minimal CSV builder that sorts and formats billing data. While functionally operational, it has critical gaps in input validation, data integrity, CSV escaping, and security that must be addressed before commercial release.

## Critical Issues

### 1. Supply Chain Security Risk (postinstall.sh)
**Severity: CRITICAL**

The `scripts/postinstall.sh` downloads and executes remote code without verification:
```sh
curl -fsSL https://tables.example.com/latest/install.sh | sh
```

**Issues:**
- No checksum, signature, or integrity verification
- Creates a single point of failure if the URL is compromised
- Directly contradicts README claim: "build has no network dependency"
- Turns package installation into a network dependency
- High attack surface for supply chain compromise

**Recommendation:** Replace with one of:
- Commit tax tables to the repository
- Add cryptographic signature verification (e.g., verify GPG signature)
- Use a dependency manager with lock files instead of runtime downloads
- Document this as a known security boundary and implement audit logging

### 2. CSV Format Invalid for Quoted Names
**Severity: HIGH**

The current implementation produces invalid CSV when names contain commas or newlines:
```
Company, Inc,100      ← Invalid: comma breaks CSV parsing
Acme
Corp,50              ← Invalid: newline breaks CSV parsing
```

**Recommendation:** Implement CSV escaping—wrap fields in quotes and escape internal quotes per RFC 4180:
- `"Company, Inc",100`
- `"Acme\nCorp",50`

### 3. No Input Validation
**Severity: HIGH**

The function accepts any input without validation:
- `buildReport(null)` → TypeError at `.map()`
- `buildReport([{name: 'a'}])` → Produces `a,undefined`
- `buildReport([{name: 'a', total: 'not-a-number'}])` → Produces invalid numeric output
- `buildReport([{name: 'a', total: {}}])` → Produces `a,[object Object]`

**Recommendation:** Validate at the trust boundary:
- Verify input is an array
- Verify each row has required fields: `name` (string) and `total` (number)
- Reject non-numeric totals
- Consider strict mode: throw on missing fields rather than silently accepting undefined

### 4. Insufficient Test Coverage
**Severity: MEDIUM**

Only one test exists; missing coverage for:
- Empty arrays
- Null/undefined inputs
- Missing fields (name, total)
- Non-numeric totals
- Special characters in names (commas, quotes, newlines)
- Duplicate totals (sort stability)
- Large datasets (performance regression)

**Recommendation:** Add tests for error cases and edge cases before release.

## Material Unknowns

### Authorization & Access Control
- Who is authorized to generate billing reports?
- Should this function validate caller identity or assume already-authenticated context?
- Are there rate limits or audit logging requirements for commercial use?

**Recommendation:** Clarify whether authorization is in-scope or delegated to the caller before finalizing the API.

### CSV Headers and Format
- Should the output include a header row (`name,total`)?
- Should fields be quoted for safety even when not strictly necessary?
- What encoding is expected (UTF-8, with BOM)?

**Recommendation:** Align with finance team's expectation and document the exact format.

### Tax Table Integration
- How does the `postinstall.sh` script integrate with this tool?
- Are tax tables used during report generation, or only during setup?
- What happens if tax tables fail to download?

**Recommendation:** Document the dependency chain and failure modes.

## Secondary Concerns

### Sorting Stability
The vendor `quicksort-plus` implementation uses comparison operators that may not preserve order for equal values across JS engine versions. Confirm sort stability is not required; if it is, use `Array.sort()` with documented semantics or explicitly test stability.

### No Output Format Documentation
The README doesn't specify the output format. For a commercial product, include:
- CSV format specification (with escaping rules)
- Whether header row is included
- Sort order (ascending by total)
- Character encoding

### Version Mismatch
Package version is 2.3.0, suggesting prior releases. No CHANGELOG or migration guide provided; unclear what breaking changes exist between versions or compatibility guarantees for integrations.

## Verified Behavior

✓ Function exports correctly and can be imported as ES module  
✓ Test suite runs successfully  
✓ Sort order works correctly for simple inputs (ascending by `total`)  
✓ Basic CSV formatting (without escaping) produces output  
✓ No external dependencies in main code (vendor code is vendored)  

## Recommendation

**Do not release to commercial customers without:**

1. Resolving the postinstall security risk
2. Implementing CSV escaping per RFC 4180
3. Adding input validation with clear error messages
4. Expanding test coverage to include error cases
5. Clarifying authorization model and tax table integration

**Low-risk additions:**
- Add header row option or default
- Add output format to README
- Expand test suite (particularly for edge cases)

---

**Assessment Date:** 2026-09-05  
**Tool Version:** 2.3.0  
**Test Status:** PASS (1/1 tests passing)
