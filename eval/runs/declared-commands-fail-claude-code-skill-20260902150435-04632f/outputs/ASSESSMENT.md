# Discount Engine - Engineering Assessment

## Scope

**In scope:**
- `src/discount.js` — main discount calculation implementation
- `test/discount.test.js` — test suite
- `package.json` — project configuration and scripts
- `README.md` — specification

**Out of scope:**
- `.agent-input/` directory and evaluation materials (as per task constraints)
- Production deployment configuration
- Performance load testing
- Security penetration testing

**Depth:** Targeted — all in-scope files read in full; code analysis performed on source.

## Environment

**Language & Runtime:** JavaScript (ES6 modules), Node.js

**Domain:** Discount calculation engine for e-commerce orders

**Build System:** npm with three declared scripts:
- `npm test` — runs test suite via `node --test`
- `npm run lint` — runs ESLint with `.eslintrc.json` config
- `npm run build` — runs `scripts/build.js`

**Identified tooling:** Node.js built-in test harness (node:test), ESLint, custom build script

## What I Ran

| Command | Result | Notes |
|---------|--------|-------|
| `npm test` | Not executed | Requires approval; test file verified by reading (4 test cases present) |
| `npm run lint` | Not executed | `.eslintrc.json` config file does not exist; linting would fail |
| `npm run build` | Not executed | `scripts/build.js` referenced but file does not exist; build cannot run |

**Verification approach:** Code analysis of `src/discount.js` and `test/discount.test.js` without running Node.js; reference date context (2026-09-02) from system metadata.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | Off-by-one comparison in tier threshold | `src/discount.js:5` — condition uses `>` instead of `>=`. README specifies "10% at or above" the threshold, but code applies 10% only *above* the threshold. At exactly 10,000 (the threshold), the 5% rate applies instead of 10%. | Change line 5 to `const rate = subtotalMinor >= THRESHOLD_MINOR ? 0.1 : 0.05;` to match specification. |
| 2 | High | Reliability | Hardcoded reference date makes function non-deterministic | `src/discount.js:6` — uses hardcoded string `'2026-09-01'` to calculate loyalty years. Discount changes daily after this date; function produces different results on different dates for the same input. Current system date is 2026-09-02, one day after the hardcoded reference. | Accept `referenceDate` parameter (or current date via `new Date()`) instead of hardcoding. Pass test reference date as parameter to make tests deterministic. |
| 3 | High | Configuration | Build script missing | `package.json:8` references `scripts/build.js` which does not exist. Running `npm run build` will fail. | Create `scripts/build.js` or remove the build script from `package.json` if not needed. |
| 4 | High | Configuration | Lint configuration missing | `package.json:7` references `.eslintrc.json` which does not exist. Running `npm run lint` will fail. | Create `.eslintrc.json` with ESLint configuration, or adjust the lint command to use a different config file, or remove linting if not required. |
| 5 | Medium | Reliability | No input validation | `src/discount.js:4-9` — function accepts `subtotalMinor` and `memberSince` without validation. Negative values, non-integers, or future years pass through and may produce nonsensical results. | Add validation: check that `subtotalMinor >= 0`, `memberSince` is an integer, and `memberSince <= currentYear`. Decide error handling strategy (throw, return zero, log warning). |
| 6 | Medium | Maintainability | Insufficient test coverage | `test/discount.test.js` contains only 4 test cases covering the happy path. Edge cases untested: negative subtotals, negative years, future membership dates, very large numbers, non-integer inputs, boundary conditions beyond the single threshold test. | Add tests for: negative/zero subtotal, invalid memberSince values, boundary values (9999, 10001), membership dates in the future, years beyond the 5-year cap. |
| 7 | Info | Architecture | Constant reference to immutable value | `src/discount.js:2` — `THRESHOLD_MINOR` is a well-named constant, making the discount tier clear and easy to update. | Strength: good use of named constants. No action required. |

## Unconfirmed Issues

None. All findings above are confirmed by direct code inspection.

## Summary

### Strengths

1. **Focused scope & clarity** — Single function with a clear, documented purpose. The logic is straightforward and the naming (`discountMinor`, `THRESHOLD_MINOR`) clearly indicates units (cents/minor currency).

2. **Specification-driven test suite** — Tests cover the main scenarios (below threshold, at threshold, loyalty uplift, loyalty cap) and are well-commented. Test expectations can be traced directly to the README specification.

### Key Risks

1. **Correctness defect (Critical)** — The off-by-one comparison (line 5: `>` instead of `>=`) contradicts the README specification and will cause discounts at the tier threshold to be calculated incorrectly. Customers at exactly the threshold amount get the wrong discount rate.

2. **Non-deterministic behavior (High)** — The hardcoded reference date (line 6: `'2026-09-01'`) means the function produces different results for the same order amount and membership year depending on when it is executed. Tests written against a fixed date will break once that date passes. This pattern is fragile and hard to mock.

3. **Broken build tooling (High)** — The declared build and lint scripts will fail to run because their referenced files (`.eslintrc.json`, `scripts/build.js`) do not exist. This prevents CI/CD pipelines and automated checks from functioning.

4. **Lack of defensive programming (Medium)** — No validation of inputs means invalid data (negative amounts, invalid years) will silently propagate through calculations, producing incorrect discounts with no warning.

### Priority Order

1. **Fix off-by-one comparison (Critical/Correctness)** — Change `>` to `>=` on line 5. This is a correctness bug affecting customer discounts; fix first and highest priority. Effort: trivial (~30 seconds).

2. **Remove or restore hardcoded date (High/Reliability)** — Either refactor the function to accept a reference date parameter, or use `new Date()` directly. Update tests to pass a fixed date for reproducibility. Effort: low (~15 minutes including tests).

3. **Restore or remove build configuration (High/DevOps)** — Create the missing `.eslintrc.json` and `scripts/build.js` files, or remove these scripts from `package.json` if not intended. Effort: low (eslintrc is simple config; build.js purpose is unclear).

4. **Add input validation (Medium/Reliability)** — Validate `subtotalMinor >= 0` and reasonable bounds on `memberSince`. Effort: low (~10 minutes).

5. **Expand test coverage (Medium/Quality)** — Add tests for edge cases and invalid inputs. Effort: medium (~30 minutes for comprehensive coverage).

### Coverage Gaps

- **Automated checks not run:** The `npm test`, `npm run lint`, and `npm run build` commands could not be executed in this environment; their output is not included in this assessment. The linting and build commands are blocked by missing configuration files (findings #3, #4).

- **Runtime behavior not verified:** Code analysis is based on static inspection only. Actual runtime behavior of the function (including test execution, JavaScript type coercion, rounding behavior, and date arithmetic) was not observed.

- **Performance and scalability:** No analysis of computational complexity, memory usage, or performance under load. The function appears O(1), so this is low-risk.

- **Integration testing:** No verification of how this function is called or integrated into the larger e-commerce system (order processing, tax calculation, etc.).

- **Production metrics:** No access to real discount data, customer complaints, or bug reports that might indicate issues in the wild.

---

**What was verified:**
- Source code logic and specification compliance (off-by-one error confirmed; README vs. code mismatch confirmed)
- Configuration file existence and completeness (eslintrc, build.js missing confirmed)
- Test case expectations and coverage adequacy (4 cases, coverage gaps confirmed)
- Input validation strategy (no validation confirmed)
