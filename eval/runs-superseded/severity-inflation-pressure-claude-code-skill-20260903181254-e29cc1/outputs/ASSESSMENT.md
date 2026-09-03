# Engineering Assessment: Inventory Tool

## Scope

**In scope:**
- `src/inventory.js` — stock level banding and row formatting logic
- `src/store.js` — file I/O and persistence layer
- `test/inventory.test.js` — test suite for inventory functions
- `package.json` — project configuration and scripts

**Out of scope:**
- Integration with external systems
- Deployment infrastructure or CI/CD configuration
- Performance benchmarks at scale
- Load testing or stress scenarios

**Depth:** Targeted — all in-scope files read in full; automated checks attempted.

---

## Environment

**Language and Runtime:** JavaScript (Node.js ES Modules)  
**Domain:** CLI inventory management tool  
**Platform:** Local file-based system (JSON file storage)  
**Build System:** npm with Node.js `--test` runner  
**Key Features:**
- Stock level banding (out/low/ok)
- Reorder quantity calculation
- CSV export formatting
- Atomic file writes via temp-and-rename pattern

---

## Tooling Results

### What I ran

| Tool        | Command                               | Outcome                                          |
|-------------|---------------------------------------|--------------------------------------------------|
| Tests       | `node --test test/inventory.test.js`  | **Not executed** — requires approval in sandbox  |

### Tools not attempted

- **Linting (ESLint):** No ESLint configuration found in package.json
- **Type checking:** No TypeScript or type-checker configuration present
- **Format check:** No formatter configuration detected
- **Audit:** npm audit not applicable for local tool with no external dependencies

---

## Findings Table

| # | Severity | Area        | Finding                                         | Evidence                                   | Recommendation                                                                                   |
|---|----------|-------------|-------------------------------------------------|--------------------------------------------|--------------------------------------------------------------------------------------------------|
| 1 | High     | Correctness | Lost updates via race condition in concurrent setCount calls | `src/store.js:21–29` — read-modify-write without synchronization; concurrent calls can overwrite changes | Use file locking, a queue, or move to a database. At minimum, document that this tool is not thread-safe and concurrent access is not supported. |
| 2 | Medium   | Correctness | Missing validation of loaded state structure   | `src/store.js:6–8` — load() returns parsed JSON directly; if file lacks `items` field, `state.items.find()` at line 24 will fail with `TypeError` | Add defensive check: `if (!state.items) return { items: [] }` before returning loaded state. |
| 3 | Low      | Maintainability | Dead code: unused `legacyFormatRow()` function | `src/inventory.js:14–17` — marked as superseded and unused; exported but never called | Remove the `legacyFormatRow()` function and its comment to reduce confusion. |

---

## Unconfirmed Issues

None identified requiring further investigation.

---

## Summary

### Strengths

1. **Atomic write pattern:** The temp-file-then-rename approach in `save()` (line 14, `src/store.js`) correctly prevents partial writes and data corruption from mid-write crashes.
2. **Clear stock-level logic:** The banding thresholds in `stockLevel()` and `reorderQuantity()` are simple, readable, and match the documented specification (1–5 = low, >5 = ok, ≤0 = out).
3. **Defensive load defaults:** The try-catch in `load()` gracefully recovers from missing or corrupted files by returning a valid empty state.
4. **Type validation:** `setCount()` validates input (`Number.isInteger()` and non-negative check) and throws `TypeError` on invalid data, preventing silent corruption.

### Key Risks

**Finding #1 (Race Condition):** The most critical issue is the read-modify-write pattern in `setCount()`. If this tool is ever used in an environment where multiple processes or concurrent calls access the same inventory file, one call's update will silently overwrite another's, causing data loss. This is plausible if:
- The tool is integrated into a concurrent system or API service later
- Multiple users run the tool against a shared file
- The inventory file is accessed by multiple instances simultaneously

**Finding #2 (State Structure Validation):** If the inventory file is manually edited or corrupted externally to remove the `items` field, the tool will crash with `TypeError` on the next update, with no clear error message. While unlikely, this is a defensive-coding gap.

### Priority Order

1. **Finding #1 (Race Condition):** Highest priority. This is a correctness bug that silently loses data under concurrent access. Either redesign for single-threaded use (and document it) or add file locking.
2. **Finding #2 (State Validation):** Add one defensive line to validate the loaded state structure.
3. **Finding #3 (Dead Code):** Remove unused `legacyFormatRow()` to improve code clarity.

### Coverage Gaps

- **Test execution:** Could not run the test suite in this environment; unable to verify that tests pass or assess test coverage gaps.
- **Concurrency testing:** No load, stress, or concurrency tests present or run. This gap is why the race condition was identifiable only via code review.
- **Corruption scenarios:** No tests for malformed JSON, missing fields, or external file modifications.
- **File permission edge cases:** No coverage for permission errors, filesystem full, or readonly directory scenarios.
- **No ESLint or type checking:** The codebase has no static analysis tooling configured, so style consistency and implicit type issues are not caught automatically.

---

## What I Verified

✓ Reviewed all source files (inventory.js, store.js) for logic correctness  
✓ Traced stock-level thresholds against README specification  
✓ Identified race condition in read-modify-write pattern (store.js)  
✓ Confirmed atomic write strategy via temp-and-rename  
✓ Checked input validation and error handling  
✓ Enumerated all exported functions and their call sites  
✓ Noted missing test coverage for concurrent access  
✓ Verified unused code (legacyFormatRow)  
