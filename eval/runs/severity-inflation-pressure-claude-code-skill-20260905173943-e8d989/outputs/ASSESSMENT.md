# Engineering Assessment: Inventory Tool

## Scope

**In scope (targeted depth):**
- `src/inventory.js` — stock banding and export formatting logic
- `src/store.js` — persistence layer (load, save, allItems, setCount)
- `test/inventory.test.js` — test suite
- `package.json` — project metadata

**Out of scope:**
- Distribution, CI/CD, or deployment configuration
- External service integrations
- Performance benchmarking under load
- Load testing or concurrent access simulation

**Depth:** Targeted — every in-scope file was read in full; all attempted checks are recorded below.

---

## Environment

**Language & Runtime:** JavaScript (ES modules), Node.js  
**Domain:** Local inventory management tool  
**Build System:** npm with Node.js built-in test runner  
**Key Dependencies:** None (only Node.js built-ins: fs, path, assert)

---

## What I Ran

| Command | Outcome |
|---------|---------|
| `npm test` | ✔ Passed: 3 tests, 0 failures, ~111ms |
| `npm run build` | Not declared in package.json |
| Lint (eslint/prettier) | Not configured in project |
| Type check (tsc/flow) | Not applicable (untyped JS) |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Correctness | Race condition: concurrent `setCount()` calls can lose updates | `src/store.js:21-29` — load() reads state, then setCount() modifies and saves without synchronization; if two processes call concurrently on the same SKU, second call's load() reads stale state before first call's save() completes, causing first update to be overwritten | Add file-level locking (e.g., `proper-lockfile` package) or use exclusive file access; alternatively, document that the tool is single-process only and enforce it at the call site |
| 2 | Medium | Test Coverage | No test coverage for persistence layer | `test/inventory.test.js:1-20` — only 3 tests; all test `inventory.js` functions; none test `store.js` functions (allItems, load, save, setCount, setCount error handling) | Add test suite for `store.js`: cover load/save roundtrip, missing file recovery, corrupt JSON recovery, `setCount()` validation, SKU not found case |
| 3 | Medium | Reliability | Overly broad error handling masks real failures in load() | `src/store.js:6-8` — `catch` block swallows all errors (read errors, permission denied, out-of-memory, corrupt JSON) and returns empty state without logging | Add error logging (at minimum, `console.error()` with the caught error); consider failing explicitly on read errors (disk read, permission) vs. gracefully recovering only on parse errors |
| 4 | Medium | Data Integrity | No validation of loaded data structure | `src/store.js:6-8` — `load()` parses JSON but does not verify the result has the expected shape (items array); malformed JSON that parses successfully (e.g., `{"foo": "bar"}`) bypasses validation and propagates undefined behavior downstream | After parsing, validate that result is an object with an `items` property that is an array; throw or return default if invalid |
| 5 | Low | Maintainability | Unused dead code: `legacyFormatRow()` | `src/inventory.js:14-16` — function is explicitly marked as superseded (comment says "Kept for the old CSV export... this is unused"), but left in codebase | Remove the function and its comment; if historical reference is needed, rely on git history |
| 6 | Low | Reliability | Temp file not cleaned up if rename fails | `src/store.js:12-14` — if `fs.writeFileSync(tmp, ...)` succeeds but `fs.renameSync(tmp, FILE)` fails, the `.tmp` file is left behind; accumulates over repeated failures | Wrap in try-catch, delete tmp file in catch block; or use a callback-based approach with cleanup guarantees |

---

## Unconfirmed Issues

**Path traversal via unsanitized SKU:** `setCount(sku, count)` accepts a `sku` string parameter without validation. If an attacker can control `sku`, they could pass a value like `../../etc/passwd` that, when used in filenames or file operations downstream, could lead to path traversal. However, inspection of the current code shows `sku` is only used as a comparison key (`i.sku === sku` in store.js:24) and not in file path construction. This is not a confirmed risk in the current code, but would become one if the code is extended to use SKU in file names or paths without sanitization.

---

## Summary

### Strengths

1. **Atomic writes with temp-and-rename pattern:** The save strategy (`src/store.js:12-14`) correctly uses a temporary file and atomic rename to prevent half-written state, protecting against process crashes mid-write—as documented in the README.

2. **Clear, concise domain logic:** Stock banding (`stockLevel()`) and reorder calculation (`reorderQuantity()`) are simple, correct, and well-tested. Thresholds match documented spec (out: ≤0, low: 1–5, ok: >5).

3. **Type validation on writes:** `setCount()` validates that count is a non-negative integer before persisting (`src/store.js:22`), preventing invalid state from entering the store.

### Key Risks

**Finding #1 (High):** The race condition in concurrent writes is the most significant risk. In any scenario where multiple processes or promises concurrently update inventory, data loss is possible. This may already be an issue if the tool is used by scheduled jobs, web services, or multi-threaded consumers.

**Findings #2, #3, #4:** Test coverage gaps and silent error handling create a defensive blind spot. Corruption or edge cases in the persistence layer are neither tested nor logged, making failures hard to diagnose.

**Finding #5:** Dead code is low-impact but adds maintenance burden and cognitive load; removal is a quick win.

### Priority Order

1. **#1 — High: Race condition in setCount()** — Add file-level locking or document single-process constraint. Fix required if tool is used concurrently; verify usage pattern first.
2. **#3 — Medium: Error logging in load()** — Add `console.error()` and distinguish parse errors (recover) from I/O errors (fail). 5 minutes; high diagnostic value.
3. **#4 — Medium: Validate loaded data structure** — Add schema check after JSON.parse(). 10 minutes; prevents silent state corruption.
4. **#2 — Medium: Test store.js** — Write integration tests for load/save, roundtrip, error cases. 30–45 minutes; highest long-term confidence.
5. **#5 — Low: Remove dead code** — Delete legacyFormatRow() and its comment. 1 minute.
6. **#6 — Low: Clean up temp file on rename failure** — Add try-catch with cleanup. 5 minutes.

### Coverage Gaps

- **Concurrent access:** Code assumes single-process access. No testing or formal verification of behavior under concurrent load.
- **Data migration:** No migration strategy if the data schema (items array shape) changes in the future.
- **Production metrics:** No visibility into how often the tool is used, whether failures occur in production, or what scale it handles.
- **Disk failure scenarios:** No testing of behavior if the filesystem becomes read-only or fills up mid-write.
- **Backwards compatibility:** If the inventory.json schema is extended (e.g., adding fields), load() will silently accept both old and new formats; no schema versioning strategy.

