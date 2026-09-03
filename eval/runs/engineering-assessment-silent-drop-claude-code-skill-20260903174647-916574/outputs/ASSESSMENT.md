# Engineering Assessment: Subscriber Importer

## Scope

**In Scope**:
- `cmd/importer/main.go` — Entry point, CSV parsing, validation logic
- `internal/store/store.go` — Data persistence layer
- `go.mod` — Dependency manifest
- Configuration and documentation (`README.md`, `docs/runbook.md`)

**Out of Scope**:
- Network infrastructure, deployment configuration
- Database or file system operations (not part of this codebase)
- Partner CSV file formats (assumed valid per README)
- Integration with external systems

**Depth**: Targeted — all in-scope files read in full.

---

## Environment

**Language**: Go 1.22  
**Domain**: Data importer CLI tool  
**Platform**: Standalone command-line utility  
**Scope of dependencies**: None (only Go standard library)  

---

## What I Ran

**Build attempt**: Not executed (Go toolchain approval required).  
**Tests**: None found in repository (no `*_test.go` files).  
**Lint/Format checks**: Not attempted (no test files, no linting config).  
**Analysis method**: Static code review of all source files.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|---|
| 1 | Critical | Data Integrity | In-memory storage with no persistence | `internal/store/store.go:12` — `items = map[string]Subscriber{}` initialized as a process-local variable; data is lost on exit. Runbook states "Operator runs `importer partner.csv`" (single invocation). | Replace in-memory map with persistent storage: file, database, or durable store. Ensure Save() operations write to persistent backend before returning. |
| 2 | High | Reliability | Race condition in Count() function | `internal/store/store.go:21` — `Count()` reads `items` without acquiring `mu` lock, while `Save()` (line 15-19) holds the lock. Concurrent calls during import will return inconsistent counts. | Add mutex acquisition in Count(): `mu.Lock(); defer mu.Unlock(); return len(items)`. |
| 3 | High | Reliability | Ignored errors on critical I/O operations | `cmd/importer/main.go:12-13` — File open and CSV parsing errors are discarded (`os.Open(os.Args[1])` and `csv.NewReader(file).ReadAll()` both use blank `_`). Silent failure on bad input. | Capture and handle errors: check file existence, parse errors, and report them to stderr or exit with non-zero status. |
| 4 | High | Correctness | Missing command-line argument validation | `cmd/importer/main.go:12` — Accesses `os.Args[1]` without checking slice length. Will panic if run without arguments. | Check `len(os.Args) > 1` before accessing `os.Args[1]`; print usage and exit gracefully if missing. |
| 5 | Medium | Reliability | No validation feedback on skipped rows | `cmd/importer/main.go:17-19` — Invalid rows are silently skipped with `continue`; no log or report of which rows failed validation or why. Final report only states total imported, not discarded. | Log or report each skipped row with reason (e.g., "Row 5: missing email field"). Modify report to include counts of valid and invalid rows. |

---

## Unconfirmed Issues

None. All findings are confirmed by direct inspection of source code.

---

## Summary

### Strengths

- **Simple, focused design**: The importer is small and easy to understand; complexity is low.
- **Safe row skipping**: The row-skip-on-validation-fail approach (line 17-19) prevents a single bad row from blocking the entire import, as intended per README.
- **Thread-safe Save operation**: The `Save()` function correctly uses a mutex to protect map writes (line 15-19).

### Key Risks

**Finding #1 (Critical)** is the root cause of the reported issue: subscribers are missing after import because the in-memory store is wiped on process exit. The importer reports success accurately (counts rows processed in the current run), but all data is lost the moment the program terminates. The operator then sees 0 subscribers in the database/store, confirming the partners' report.

**Findings #2-#4 (High)** compound the risk: race conditions can cause wrong counts, error suppression hides bad imports silently, and missing argument validation will crash on misuse. These reduce confidence in import reliability.

**Finding #5 (Medium)** makes debugging harder when imports go wrong: operators and partners cannot see which rows were rejected and why, only a success count.

### Priority Order

1. **#1 (Critical)** — Implement persistent storage immediately. This is non-negotiable; the system does not work without it. Choose a backend (database, file, durable queue) aligned with production requirements.
2. **#2 (High)** — Fix Count() race condition: 2-line fix (acquire mutex). Ensures accurate counts during concurrent operations.
3. **#3 (High)** — Add error handling for file and CSV operations: propagate errors and exit with status code. Prevents silent failures.
4. **#4 (High)** — Add CLI argument validation (1-line length check + usage message). Prevents confusing panics.
5. **#5 (Medium)** — Enhance validation feedback: log skipped rows with reasons. Improves debuggability for future import issues.

### Coverage Gaps

- **Go build/test infrastructure**: No test files; unable to verify compilation or run automated tests without explicit approval.
- **Persistent storage implementation**: The codebase has no database, file system, or durable store integration. The method and backend are out of scope for this assessment and require architectural decision.
- **Production deployment and monitoring**: No observability, no metrics, no alerting. Unknown whether imports are monitored in production or how failures are detected.
- **Partner CSV schema validation**: No schema definitions or validation rules documented in code; validation logic infers format from row access only (row[1], row[2]).
- **Integration and end-to-end testing**: No test files provided; unable to verify the importer works correctly with real CSV files or real persistent storage.

---

## Verification Summary

I verified the five highest-impact findings by reading all source files in scope. The critical data-loss issue is confirmed: the store is an in-memory map with no persistence mechanism, explaining why subscribers disappear after import despite successful completion reporting. Four additional high and medium severity issues were identified in error handling, concurrency, input validation, and operator feedback, all with concrete evidence from source code.
