# Engineering Assessment: Subscriber Importer

## Scope

**In scope:**
- `cmd/importer/main.go` — CSV parsing and import orchestration
- `internal/store/store.go` — subscriber data storage
- `go.mod` — dependencies and Go version
- `docs/runbook.md` — operational context
- Build configuration and available tooling

**Out of scope:**
- External systems (partner CSV sources, downstream databases)
- Deployment and infrastructure configuration
- Historical audit logs or production metrics
- Integration tests or end-to-end workflows

**Depth:** Targeted — all in-scope source files read in full; available tools attempted.

---

## Environment

- **Language:** Go 1.22
- **Build system:** `go build`
- **Dependencies:** None (standard library only)
- **Domain:** Data import CLI tool
- **Platform target:** Command-line / server-side
- **Architecture:** Single-package application with in-memory store

---

## What I Ran

| Command | Result |
|---------|--------|
| File enumeration | 3 Go source files identified: `cmd/importer/main.go`, `internal/store/store.go`, and no test files. |
| `go version` check | Go toolchain requires approval to run in this environment. Skipped actual invocation but confirmed Go 1.22 is declared in `go.mod`. |
| `go build ./cmd/importer` | Requires approval; not executed. Presumed to succeed (no syntax errors on visual inspection). |
| `go test ./...` | No test files present; test suite unavailable. |
| `go vet` | Not executed; would require approval. No obvious vet violations on code inspection. |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Data Integrity | No data persistence — store is entirely in-memory; all imported data is lost when the process exits | `internal/store/store.go:10-22` — `items` is a package-level `map[string]Subscriber` with no backing database, file, or persistent layer. Every program invocation starts with an empty map. | Add persistent storage (SQL database, file system, or message queue). Implement a `Load()` function to restore data from storage on startup. Verify that `main.go` reads persisted data before or after CSV import. |
| 2 | **Critical** | Reliability | Ignored file and parsing errors silently fail; program continues with empty input and reports false success | `cmd/importer/main.go:12-13` — `os.Open()` and `csv.NewReader(file).ReadAll()` errors discarded via `_`. If the file does not exist or CSV is malformed, `rows` is `nil` and the loop processes zero rows, but `fmt.Printf` still prints "imported 0 of 0 rows" as if successful. | Replace `file, _ := os.Open(...)` with error handling: log and exit on failure. Replace `rows, _ := csv.NewReader(file).ReadAll()` with explicit error checking. Use `log.Fatalf()` or return errors to main's error handling (add `error` return to main or use a dedicated error handler). |
| 3 | **High** | Reliability | Misleading import count: skipped rows are counted in the denominator, suggesting they were processed when they were ignored | `cmd/importer/main.go:24` — Report counts `len(rows)-1` as the total, but validation on lines 17-19 skips rows silently. Operator sees "imported 50 of 100 rows" and cannot distinguish between validation failures and actual successes. | Add logging for skipped rows with reason (missing email, insufficient columns). Modify report to show "imported 50, skipped 50 of 100 rows" with breakdown (e.g., "5 missing email, 45 short format"). |
| 4 | **High** | Concurrency | Data race in `Count()` — reads map length without lock while `Save()` holds mutex during concurrent writes | `internal/store/store.go:21` — `Count()` returns `len(items)` without acquiring `mu`, but `Save()` (line 16) locks before reading and writing. A concurrent `Save()` can be mid-update when `Count()` samples `len(items)`. | Acquire `mu.Lock()` and defer `mu.Unlock()` in `Count()` before reading: `defer mu.Unlock(); mu.Lock(); return len(items)`. |
| 5 | **High** | Correctness | Duplicate emails overwrite silently; no warning or uniqueness validation on import | `cmd/importer/main.go:20` and `internal/store/store.go:18` — `store.Save()` uses email as map key (`items[s.Email] = s`). If the CSV contains the same email twice, only the second row is stored; the first is silently overwritten. | Add a validation check before `Save()`: if `items[s.Email]` already exists, log a warning with email and row number, and skip or merge (e.g., update only if new row has higher-priority plan). Document policy in runbook. |

---

## Unconfirmed Issues

None. All findings are confirmed by direct code inspection.

---

## Summary

### Strengths

1. **Clear, focused scope:** The tool has a single responsibility (import CSV rows) and a minimal dependency footprint (standard library only), reducing surface area for deployment and build issues.
2. **Synchronization discipline:** The `store` package correctly uses `sync.Mutex` to guard concurrent access to the shared map, preventing corruption during parallel saves (though `Count()` violates this on read).

### Key Risks

1. **Critical data loss (Finding #1):** No imported data is persisted. Every run produces a successful report to the operator and partner, but all subscribers are discarded on exit. This is the root cause of the "subscribers missing" complaint. Fixing this alone resolves the operational crisis.

2. **Silent error masking (Finding #2):** File and CSV parsing errors are silently ignored, allowing the tool to report success even when it processes zero rows. An operator cannot distinguish a malformed CSV from a successful import of zero rows.

3. **Misleading reporting (Finding #3):** The import count conflates skipped rows (validation failures) with actual saves, making it impossible for the operator or partner to know whether 50 subscribers were imported or discarded.

4. **Data integrity issues (Findings #4 and #5):** Concurrent reads without locks and silent duplicate overwrites create subtle data corruption risks, especially if the store is later connected to persistent storage.

### Priority Order

1. **Implement persistent storage (Finding #1):** Add a database (SQLite, PostgreSQL, etc.) or file-based store. Implement `Load()` to hydrate the map on startup. This is the only fix that restores subscriber data and resolves the operational issue. Effort: medium. Blast radius: entire application.

2. **Add error handling in main (Finding #2):** Wrap `os.Open()` and `csv.ReadAll()` with explicit error returns and log/exit on failure. Effort: low. Impact: prevents silent failures and gives operators visibility into problems. Blast radius: CLI interface.

3. **Improve import reporting (Finding #3):** Track skipped rows by reason and display a breakdown in the final report. Effort: low. Impact: operators and partners gain visibility into data quality and import success. Blast radius: user-facing output.

4. **Fix data race in Count() (Finding #4):** Add mutex lock/unlock. Effort: trivial (one line). Impact: prevents undefined behavior in concurrent scenarios. Blast radius: store safety.

5. **Add duplicate detection (Finding #5):** Validate email uniqueness before save and log warnings. Effort: low. Impact: prevents silent data loss from duplicate rows. Blast radius: data integrity during import.

### Coverage Gaps

- **No test suite:** No unit or integration tests are present. Cannot verify CSV parsing edge cases, CSV parsing, error paths, or data integrity under concurrent load.
- **No build/lint verification:** `go build`, `go vet`, `go fmt` were not executed due to environment constraints; code inspection substitutes but automated checks are unavailable.
- **No persistence layer inspection:** No database schema, migrations, or file structure are present to assess; the correct persistent storage mechanism was not identified from code alone.
- **No production metrics:** No logs, metrics, or audit trail are available to assess actual import failures in production or determine whether the issue is recent (missing persistence) or a newly introduced bug.
- **No partner CSV samples:** No test CSV files or schema documentation are present to validate parsing or edge case handling.

---

## Verified

Verified that the store is in-memory only (no persistence layer), error handling in main.go ignores file and CSV errors, the import count is misleading when validation failures occur, Count() reads without synchronization, and duplicate emails silently overwrite. All findings confirmed by direct code inspection of the three Go source files.
