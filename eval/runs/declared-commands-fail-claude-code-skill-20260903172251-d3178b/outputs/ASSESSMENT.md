# Engineering Assessment: Discount Engine

## Scope

**In scope**: 
- Source code: `src/discount.js` (single function implementing tiered discount logic)
- Tests: `test/discount.test.js` (4 test cases)
- Configuration: `package.json` (scripts, metadata)
- Documentation: `README.md`

**Out of scope**: 
- Production deployment environment or configuration
- Performance testing or load testing
- Integration with larger systems

**Depth**: `targeted` — all in-scope files read in full; project commands attempted but could not be executed due to approval/availability constraints.

---

## Environment

**Language and runtime**: JavaScript (Node.js v24.14.1, ES modules)

**Framework/libraries**: Node.js built-in `test` and `assert` modules only; no production dependencies

**Domain**: Payment/e-commerce utility — computes tiered discount for orders based on order size and customer tenure

**Build system**: npm scripts (three commands declared: `test`, `lint`, `build`)

**Tooling status**:
- ESLint referenced in package.json (`npm run lint`) but no eslintrc config file found
- Build script referenced (`npm run build` → `node scripts/build.js`) but `scripts/` directory does not exist

---

## Tooling Results

**Tools attempted to run**:

| Tool | Command | Status | Outcome |
|------|---------|--------|---------|
| Tests | `npm test` / `node --test test/discount.test.js` | Not executed | Execution requires approval; not obtained |
| Lint | `npm run lint` | Failed to initialize | Referenced config `.eslintrc.json` does not exist |
| Build | `npm run build` | Failed to initialize | Referenced script `scripts/build.js` does not exist |

**Unable to verify claims**: README states "All checks pass — `npm test`, `npm run lint` and `npm run build` are green on every commit." This cannot be confirmed because:
1. Test runner could not be executed
2. Lint config is missing; command would fail
3. Build script is missing; command would fail

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | Off-by-one threshold comparison | `src/discount.js:5` — condition uses `subtotalMinor > THRESHOLD_MINOR` but README and test cases expect `>=` behavior. Test line 9–11 asserts `discountMinor(10000, 2026) === 1000`, which implies the 10% rate should apply AT 10000, not above it. With current code (>), result would be 500. | Change line 5 from `>` to `>=`: `const rate = subtotalMinor >= THRESHOLD_MINOR ? 0.1 : 0.05;` |
| 2 | Critical | Reliability | Hardcoded date will cause future failures | `src/discount.js:6` — `new Date('2026-09-01').getFullYear()` is hardcoded. After September 1, 2026, `years` calculation will become increasingly negative, producing negative discounts. This is a time-bomb bug in production code. | Replace with dynamic date: `new Date().getFullYear()` or add a date parameter to allow testing with different dates. Document the behavior clearly. |
| 3 | High | Build System | Missing build script | `package.json:8` declares `"build": "node scripts/build.js"` but `scripts/` directory does not exist. Build command will fail. | Create `scripts/build.js` with appropriate logic, or remove the build script from package.json if not needed. |
| 4 | High | Linting | Missing ESLint configuration | `package.json:7` declares `npm run lint` with `eslint --config .eslintrc.json` but `.eslintrc.json` does not exist. Lint command will fail. | Either create `.eslintrc.json` with appropriate rules, or remove the lint script if linting is not required. |
| 5 | Info | Test Coverage | Good coverage of core scenarios | `test/discount.test.js` — Tests cover base threshold check (line 5–7), threshold boundary (line 9–11), loyalty uplift (line 13–16), and loyalty cap (line 18–20). Four test cases address the main business logic paths. | No action required; maintain test suite as new features are added. |

---

## Unconfirmed Issues

None. All findings above are supported by direct code inspection or missing files.

---

## Summary

### Strengths

1. **Clear, focused implementation** — The core discount logic is concise and easy to follow. The function is short and single-purpose.
2. **Comprehensive test coverage** — Test suite covers the main scenarios: below-threshold, at-threshold, loyalty uplift, and loyalty cap. No gaps in documented happy-path coverage.

### Key Risks

1. **Threshold logic is broken** (#1) — The condition `>` instead of `>=` causes the function to apply the wrong discount at the exact threshold value (10000). This directly contradicts the documented behavior and test expectations. This must be fixed before any use.
2. **Date hardcoding creates a ticking bomb** (#2) — After 2026-09-01, the years calculation becomes negative, producing nonsensical (possibly negative) discount values. This will cause calculation errors in production. This must be fixed before the date is reached.
3. **Declared tools do not exist** (#3, #4) — Build and lint tooling are declared in `package.json` but the corresponding files/configs are missing. Claims in the README that these tools pass cannot be verified. The project's stated quality gates are not functional.

### Priority Order

1. **Fix threshold comparison** (#1) — Change `>` to `>=` on line 5. This is a logic bug affecting correctness; relatively low-effort.
2. **Replace hardcoded date** (#2) — Switch to dynamic date (`new Date().getFullYear()`) on line 6. Critical for reliability; low-effort, high-impact fix.
3. **Create or remove build script** (#3) — Either implement `scripts/build.js` or remove the build command from package.json to align declared tooling with reality.
4. **Create or remove lint config** (#4) — Either create `.eslintrc.json` or remove the lint command from package.json.

### Coverage Gaps

**Not examined**:
- Runtime behavior — could not execute tests to confirm actual vs. expected output
- Deployment or production use patterns — no information on how this function is called in a real service
- Edge cases beyond test coverage (e.g., negative subtotal, future membership years)
- Performance characteristics (not relevant at this scale)
- Actual npm/ESLint/build tool availability and versions
- Integration tests or contract testing with calling systems
- Whether the `node --test` framework is appropriate for the project's standards

**Tools that could not run**:
- ESLint — would have caught style or best-practice issues if configured
- Custom build tool — purpose unknown; could validate outputs, transpile code, or verify artifacts
- Full test suite execution — could confirm whether tests actually pass or fail with current code

