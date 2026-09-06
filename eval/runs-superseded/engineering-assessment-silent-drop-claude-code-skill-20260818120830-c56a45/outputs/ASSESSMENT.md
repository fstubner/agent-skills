# Engineering Assessment: Subscriber Importer

## Scope

**In scope:**
- All application code: `cmd/importer/main.go` and `internal/store/store.go`
- Configuration and build metadata: `go.mod`
- Documentation: `README.md`, `docs/runbook.md`
- Depth: **Targeted** — all source files read in full; code review for correctness, data integrity, error handling.

**Out of scope:**
- External dependencies (no vulnerabilities audit run)
- Performance profiling or load testing
- Integration testing against a real database
- Deployment and infrastructure configuration
- Historical commit analysis or git history

## Environment

**Language & Runtime:** Go 1.22  
**Domain:** CLI tool for importing subscriber data from CSV files  
**Key Patterns:** In-memory storage with mutex-protected map; CSV parsing with row validation  
**Build System:** Go modules (`go.mod`)

## Tooling Results

**Tools attempted:**
- Go build: Requested but not executed (requires approval; not necessary for code review)

**Tools not attempted:**
- `go test`: No test files present in the repository
- `go fmt`: Code formatting check (out of scope for this assessment)
- `go vet`: Static analysis (not critical for identified issues)

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Data Integrity | All subscriber data is stored in-memory with no persistence mechanism; data is lost when the program exits | `internal/store/store.go:10-13` — module-level `items` map is never flushed to disk, database, or any persistent storage. No backing store is defined anywhere in the codebase | Implement persistent storage: add a database backend (e.g., SQLite, PostgreSQL) or file-based persistence to the `Save()` function. Data must survive process termination. |
| 2 | **Critical** | Reliability | File I/O errors are silently ignored, allowing corrupted or missing imports to be reported as successful | `cmd/importer/main.go:12-13` — `os.Open()` and `csv.ReadAll()` errors both ignored with blank `_` identifiers. If file open fails or CSV is malformed, parsing proceeds with `rows` nil or incomplete, yet success is reported | Check both errors explicitly: `if err != nil { fmt.Fprintf(os.Stderr, "error: %v\n", err); os.Exit(1) }`. Log the actual error to help operators diagnose failures. |
| 3 | **Critical** | Reliability | Opened file handle is never closed, causing a file descriptor leak with each import | `cmd/importer/main.go:12` — `file` is opened but has no deferred close statement. Each invocation leaves an unclosed file handle that is only released when the process exits | Add `defer file.Close()` immediately after error check on line 12. This prevents resource exhaustion on repeated imports. |
| 4 | **High** | Correctness | Reported import count does not match actual stored records due to email-based key deduplication | `cmd/importer/main.go:24` reports `imported` count (total rows passing validation). `internal/store/store.go:18` overwrites duplicate emails silently (`items[s.Email] = s`). If 10 rows pass validation but 2 have duplicate emails, operator reports "imported 10" but store contains 8. Runbook says "repeating imports is safe" but creates false row counts. | Change the report to show actual unique count: call `store.Count()` instead of the local `imported` variable. Alternatively, redesign storage to allow multiple records per email or use a true ID field rather than email as the key. |
| 5 | **High** | Data Integrity | Empty Plan field (column 3) is not validated; allows incomplete subscriber records to be saved | `cmd/importer/main.go:17` validates `len(row) < 3 \|\| row[1] == ""` but does not check if `row[2]` (Plan) is non-empty. A row with a valid email but empty plan passes validation and is saved as a broken record | Add explicit validation: `\|\| len(row[2]) == 0 || row[2] == ""` to the condition on line 17. Require Plan to be a non-empty value. |

## Unconfirmed Issues

None identified with insufficient evidence.

## Summary

### Strengths

- **Simple, readable code structure:** The application is straightforward and easy to understand at a glance. CSV parsing logic is clear, and the CSV validation check on `main.go:17` demonstrates intentional filtering of incomplete rows.
- **Thread-safe save operation:** The `store.Save()` function correctly uses a mutex to protect concurrent access to the in-memory map, preventing data corruption from simultaneous writes (`internal/store/store.go:16-18`).

### Key Risks

The root cause of the missing subscriber issue is **Finding #1**: all data is stored in-memory and lost when the program exits. This directly explains the reported behavior: the import tool claims success (printing the row count), but subscribers vanish because there is no persistent storage.

**Finding #2** (ignored errors) creates a secondary risk: if the CSV file is unreadable or malformed, the operator cannot distinguish a failed import from a successful empty one — both print `"imported 0 of X rows"` without indicating the error cause.

**Finding #3** (unclosed file) will exhaust file descriptors if imports are performed repeatedly without restarting the process.

**Findings #4 and #5** are data quality issues: reported counts can be misleading (due to deduplication), and incomplete Plan fields are accepted without validation.

### Priority Order

1. **Finding #1** (in-memory storage) — Data loss is the primary failure. Implement persistent storage immediately. This blocks any real-world use.
2. **Finding #2** (silent errors) — Add error handling and logging so operators can detect and diagnose failures. High blast radius: every import could fail silently.
3. **Finding #3** (file leak) — Defer file close to prevent resource exhaustion on repeated runs.
4. **Finding #4** (count mismatch) — Correct the reported row count to reflect actual stored records; update runbook if repeating imports is intended behavior.
5. **Finding #5** (empty Plan validation) — Add validation for required Plan field to prevent incomplete records.

### Coverage Gaps

- **No test suite:** The repository has no `*_test.go` files. Critical logic (CSV parsing, validation, storage) is untested and cannot be verified for correctness without manual testing.
- **No database or persistence layer:** The codebase assumes an in-memory store but provides no implementation or configuration for a real backend (SQL, file, cloud storage, etc.).
- **No integration or end-to-end testing:** Cannot verify that imports actually persist or that the reported counts match records stored.
- **No error/recovery strategy:** No logging, monitoring, or alerting configuration to detect import failures in production.
- **No backward compatibility or migration strategy:** If storage is added later, there is no plan for migrating existing data (though currently there is no persistent data to migrate).
- **No specification of Plan field validation rules:** The code rejects empty Plan but does not specify allowed values, format, or constraints (required for future validation additions).
