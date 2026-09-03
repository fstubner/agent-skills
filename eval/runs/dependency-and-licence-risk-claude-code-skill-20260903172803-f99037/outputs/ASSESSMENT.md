# Engineering Assessment: Billing Report Tool

## Scope

**In Scope:**
- `src/report.js` — main business logic for report building
- `test/report.test.js` — test suite
- `vendor/quicksort-plus.js` — vendored sorting library
- `scripts/postinstall.sh` — installation script
- `package.json` — project configuration and dependencies

**Out of Scope:**
- External services (`tables.example.com`)
- Production deployment infrastructure
- Commercial licensing agreements beyond code inspection
- Runtime environment at deployment time

**Depth:** Targeted — every file in scope read in full.

## Environment

**Language and Runtime:** JavaScript (Node.js)
- Node.js v24.14.1 available
- ECMAScript modules (`"type": "module"` in package.json)

**Build System and Tooling:**
- npm (package manager)
- Node.js built-in test runner (`node:test`)
- Node.js built-in assertions (`node:assert`)

**Domain:** CLI tool — builds monthly billing CSV report for finance team

**Platform Target:** Server-side (Node.js CLI)

## Tooling Results

**What I Ran:**

| Command | Result |
|---------|--------|
| `node --version` | v24.14.1 — success |
| `npm test` | Requires approval; not executed in this environment |
| `npm run build` | Not defined in package.json; not applicable |
| `npm run lint` | Not defined in package.json; not applicable |
| `npm audit` | Not executed (approval required in this environment) |

**Tools Not Attempted:**
- Type checking (no TypeScript configuration)
- Format checking (no formatter configuration)

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Unsafe remote code execution in postinstall script | `scripts/postinstall.sh:4` — `curl -fsSL https://tables.example.com/latest/install.sh \| sh` pipes downloaded script directly to shell with no verification or checksum validation | Replace with download-to-file approach, verify checksum before execution, use HTTPS certificate pinning, or document the security model if this is intentional |
| 2 | **Critical** | Data Integrity | GPL v3 licensed code in proprietary project creates licensing conflict | `vendor/quicksort-plus.js:1-8` — GPLv3 header; `package.json:5` states `"license": "UNLICENSED"` — GPL v3 requires derivative works to be GPL v3, incompatible with proprietary licensing | Either: (a) relicense entire project as GPL v3, (b) replace with permissively-licensed sort (e.g., MIT), or (c) implement custom sort to remove dependency |
| 3 | **High** | Reliability | No input validation on required fields in buildReport function | `src/report.js:4` — function assumes rows have `name` and `total` properties without checking; missing property access will silently produce `undefined` in output | Add validation: check that each row has `name` and `total` properties; throw or return error if missing |
| 4 | **High** | Data Integrity | CSV output lacks escaping for special characters | `src/report.js:4` — `${r.name},${r.total}` directly interpolates name without escaping; name containing comma or newline will corrupt CSV format | Escape name values: surround with quotes and escape internal quotes per RFC 4180, or use a CSV library |
| 5 | **Medium** | Maintainability | Test suite covers only happy path; missing edge case coverage | `test/report.test.js` — only one test case; no tests for empty array, null values, missing properties, special characters, or large datasets | Add test cases for: empty input array, rows with missing properties, names with commas/newlines/quotes, duplicate totals, numeric type coercion |
| 6 | **Medium** | Architecture | Tight coupling between report formatting and sorting | `src/report.js:1-4` — sorting is performed inside buildReport; cannot reuse data sorted for other purposes without re-sorting | Consider separating concerns: accept pre-sorted data or return sorted data without formatting applied |

## Unconfirmed Issues

**Requires Investigation:**
- **External dependency security:** `tables.example.com/latest/install.sh` — cannot verify what this script does or whether it updates vendor files. If it modifies `vendor/quicksort-plus.js`, this bypasses code review and could introduce vulnerabilities. Recommended action: document what this script installs and why, or make its behavior deterministic and reviewable.
- **CSV escaping requirement:** Cannot confirm whether customer data contains special characters without access to sample billing data. If data is guaranteed to be alphanumeric, finding #4 may be Low priority.

## Summary

### Strengths

- **Clear, focused responsibility:** The module does one thing — building a sorted billing report. The main function is straightforward and easy to understand.
- **Existing test coverage:** The project includes automated tests, demonstrating commitment to correctness.

### Key Risks

**Critical Issues (Must Fix Before Release):**
1. **Finding #1 (Unsafe postinstall)** — Downloading and executing arbitrary code at install time is a supply chain attack vector. Every installation/CI run is at risk.
2. **Finding #2 (License conflict)** — GPL v3 code in proprietary project violates the GPL v3 license terms and exposes the company to legal liability.

**High Issues (Strongly Recommended Before Release):**
3. **Finding #3 (Input validation)** — Missing field access will produce corrupted output without error, making issues difficult to diagnose.
4. **Finding #4 (CSV escaping)** — Customer names with special characters will corrupt the billing report.

### Priority Order

1. **Fix Finding #2 (License conflict)** — Blocking release risk; requires architecture decision but no other fixes depend on this.
2. **Fix Finding #1 (Postinstall security)** — Blocking release risk; high impact on supply chain; can be fixed independently.
3. **Fix Finding #3 (Input validation)** — Prevents silent data corruption; moderate effort (add 3-4 checks).
4. **Fix Finding #4 (CSV escaping)** — Depends on whether customer data contains special characters; moderate effort if needed.
5. **Add test coverage (Finding #5)** — Lower priority than correctness fixes but important for long-term maintenance.

### Coverage Gaps

**Not Examined:**
- Actual output against finance team requirements — cannot confirm CSV format matches expected schema (column order, precision for decimal values, etc.)
- Runtime behavior with production-scale data (large row counts, field size limits)
- Integration with downstream systems that consume the CSV
- Deployment and operational security (file permissions, access control)
- Performance characteristics (sort stability, memory usage, execution time on 1M+ row datasets)
- The specific contents and behavior of `tables.example.com/latest/install.sh` — this determines whether finding #1 risk is mitigated by external controls
- License grant and distribution terms for quicksort-plus v0.4.1 beyond what appears in the vendored source

**Tools Not Run:**
- Unit test execution (required approval in this environment) — would confirm actual test behavior
- `npm audit` (required approval) — would identify known vulnerabilities in any npm dependencies
- Static analysis (no ESLint or similar configured)
- Code coverage analysis (no coverage tool configured)
