# Engineering Assessment: Inventory Tool

## Scope

**In scope**: 
- `src/inventory.js` — stock level classification and row formatting logic
- `src/store.js` — file I/O and state management 
- `test/inventory.test.js` — unit tests
- `package.json` — project configuration and build/test scripts

**Out of scope**: 
- `.agent-input/` directory (evaluation infrastructure)
- Integration tests or end-to-end workflows
- Performance or load testing
- Deployment or CI/CD configuration
- Production data or usage metrics

**Depth**: Targeted — all in-scope files read in full; attempted to run project commands.

---

## Environment

**Language/Runtime**: JavaScript (Node.js, ES modules)

**Domain**: Inventory management utility — calculates stock levels, formats CSV export rows, and persists inventory data to JSON

**Platforms**: Node.js command-line tool

**Key Dependencies**: None (uses only Node.js standard library: `fs`, `path`, `assert`, `node:test`)

**Build/Test Tooling**: 
- Test command: `node --test test/inventory.test.js`
- No build step; ES modules run directly

---

## Tooling Results

### What I Ran

| Command | Status | Notes |
|---------|--------|-------|
| `node --test test/inventory.test.js` | Requires approval | Could not execute; permission restriction |
| Code inspection | ✓ Complete | All source files read in full |

### Tools Not Attempted
- Linting (no eslint or similar config present)
- Type checking (no TypeScript or JSDoc type annotations)
- Dependency audit (no vulnerabilities to check; standard library only)
- Formatting check (no prettier/format config present)

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Correctness | Inconsistent stock level boundary; `LOW_STOCK = 5` but `stockLevel()` treats 5 as 'low' not 'ok' | `src/inventory.js:1, 5` — constant is `5` but the condition is `count <= LOW_STOCK`, placing 5 in the 'low' band, contradicting the intuitive meaning of a threshold named "LOW_STOCK" | Rename constant to `STOCK_THRESHOLD = 5` or revise threshold logic to `count < LOW_STOCK` to make 6+ items 'ok'. Document the intended meaning in code. |
| 2 | High | Maintainability | Dead code: `legacyFormatRow()` marked as superseded (March migration) but never removed | `src/inventory.js:13-17` — function definition with comment stating it is unused and superseded | Remove the dead function. Its history is preserved in version control; keeping it adds maintenance burden and confusion. |
| 3 | Medium | Reliability | Missing error handling in `allItems()` and state load failure recovery | `src/store.js:6-8, 18` — `load()` silently returns `{ items: [] }` on read/parse failure, but `allItems()` returns this directly without validation; if the JSON becomes corrupted, users may unknowingly work with a reset state | Add logging or explicit error signaling to `allItems()`. Consider whether silent recovery is intentional or should bubble errors so users know data may have been lost. Document this behavior. |
| 4 | Medium | Reliability | `setCount()` silently returns null on missing SKU without logging context | `src/store.js:21-29` — when no item matches the provided SKU, function returns `null`. Caller has no indication of whether the operation succeeded or the SKU did not exist. | Return a result object `{ success: boolean, error?: string }` or throw an error. Alternatively, document that `null` return means "SKU not found" in the function's JSDoc. |
| 5 | Medium | Correctness | Potential race condition in `save()` — no atomic guarantee if process crashes between `JSON.stringify()` and `renameSync()` | `src/store.js:10-15` — while rename is atomic, the write uses `writeFileSync()` which can be interrupted; the `.tmp` file could remain on disk. No cleanup or detection of stale `.tmp` files on startup. | Add `.tmp` file cleanup on startup; consider whether atomic write strategy is sufficient for data safety (document assumptions). |
| 6 | Low | Architecture | No validation of item structure in `setCount()` before write | `src/store.js:21-29` — function validates `count` but does not validate that the item found actually has required fields (sku, name, count), or that the entire state object is well-formed before saving | Add optional runtime schema validation, or document the assumption that loaded state is always well-formed. |

---

## Unconfirmed Issues

None. All findings are supported by direct code inspection and well-defined behavior expectations.

---

## Summary

### Strengths

1. **Safe atomic writes via temp-and-rename pattern** (`src/store.js:10-15`) — the codebase avoids partial writes by writing to a temporary file before renaming into place, reducing corruption risk during crashes.

2. **Clear, simple API surface** — `inventory.js` exposes focused, single-responsibility functions (`stockLevel()`, `reorderQuantity()`, `formatRow()`) with straightforward signatures.

3. **Basic test coverage** — test file covers the main classification and formatting logic with representative boundary cases (stock levels at 0, 5, 6, and negative; reorder quantity over/under target).

### Key Risks

1. **Critical: Misleading constant naming and boundary ambiguity** (Finding #1) — the `LOW_STOCK = 5` constant and its use in `count <= LOW_STOCK` creates confusion. Is 5 items low or ok? Current logic places 5 in the 'low' band, but the constant name suggests it is the threshold for non-low. This ambiguity could lead to incorrect inventory decisions or user confusion.

2. **High: Dead code accumulation** (Finding #2) — unused `legacyFormatRow()` signals incomplete cleanup from the March migration and adds maintenance burden.

3. **Moderate: Silent data recovery without alerting the user** (Finding #3) — if the inventory file becomes corrupted or unreadable, `allItems()` silently returns an empty inventory, potentially causing data loss without the caller's knowledge.

4. **Moderate: Unclear error semantics** (Finding #4) — `setCount()` returning `null` for a missing SKU is ambiguous compared to throwing an error or returning a structured result.

### Priority Order

1. **Clarify and fix stock level boundaries** (Finding #1) — Document the intended meaning of `LOW_STOCK`, then update constant name or threshold logic for consistency. This is foundational to correctness.

2. **Remove `legacyFormatRow()`** (Finding #2) — Quick cleanup; eliminates maintenance burden.

3. **Add error visibility to `allItems()`** (Finding #3) — Ensure users are aware if inventory data is lost or corrupted.

4. **Standardize error handling in `setCount()`** (Finding #4) — Define and document whether missing SKUs return null, throw, or return a result object.

5. **Verify and document the race-condition scenario in `save()`** (Finding #5) — Clarify assumptions around atomicity and add `.tmp` cleanup on startup if needed.

6. **Add optional schema validation** (Finding #6) — Low priority, but consider documenting or validating item structure assumptions for future maintainers.

### Coverage Gaps

- **Tests not executed** — Could not run `node --test` due to permission restrictions; cannot verify that all tests pass or that coverage reflects the code read.
- **No type checking** — No TypeScript, JSDoc types, or static analysis was run; potential type-related bugs are undetected.
- **No linting or code formatting rules** — No ESLint or Prettier config; code quality conventions are not enforced.
- **No integration or end-to-end tests** — Only unit tests examined; workflows involving multiple modules together are untested.
- **No data migration or schema evolution testing** — Examined only happy-path state loading; no corruption recovery or backward compatibility scenarios tested.
- **No concurrency/multi-process testing** — Race conditions with simultaneous reads/writes are not explored.
- **Production environment verification** — No access to production data, deployment config, or runtime logs to verify actual usage patterns or failure modes.

---

**Assessment completed**: Code read in full. All findings are evidence-based and drawn from static analysis. Tests could not be executed due to permission restrictions but were reviewed for coverage.
