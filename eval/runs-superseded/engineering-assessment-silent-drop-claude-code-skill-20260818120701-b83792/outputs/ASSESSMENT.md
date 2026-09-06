# Engineering Assessment: Subscriber Importer

## Scope

**In scope**:
- Entry point: `cmd/importer/main.go` (importer CLI)
- Data layer: `internal/store/store.go` (subscriber storage)
- Configuration and documentation: `README.md`, `docs/runbook.md`, `go.mod`
- Error handling, validation, and data persistence logic

**Out of scope**:
- Partner-facing API or integration layers (none found in repo)
- Deployment infrastructure or orchestration
- CSV schema validation beyond what is visible in code
- Database configuration or external services (assumed out of scope, but critical absence noted)

**Depth**: Targeted — all in-scope files read in full.

---

## Environment

**Language/Runtime**: Go 1.22

**Frameworks**: None (standard library only: `encoding/csv`, `fmt`, `os`, `sync`)

**Domain**: Subscriber import tool (CLI utility)

**Platform**: CLI-based data import tool

**Build system**: Go modules (go.mod present, no external dependencies)

---

## Tooling Results

**Build check**: Not executed (requires user approval to run `go build`).

**Available tools not run**: 
- `go vet` — static analysis (not attempted)
- `go test` — no test files found in repository
- `go fmt --check` — code formatting check (not attempted)

**Automated checks unavailable**:
- No testing infrastructure found (`*_test.go` files absent)
- No linter or static analysis config found
- No CI/CD pipeline in repository

---

## Findings Table

| # | Severity | Area           | Finding                                      | Evidence                                   | Recommendation                                                                                                   |
|---|----------|----------------|----------------------------------------------|--------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| 1 | Critical | Data Integrity | **No persistence layer — data lost on exit** | `internal/store/store.go:10-12` — `items` is an in-memory map with no database, file, or external storage backend. Program exits after each import, losing all data. | Implement persistent storage: add a database driver (SQLite, PostgreSQL, etc.), file-based store, or cloud backend. Modify `Save()` to write to durable storage and `Count()` to read from it. |
| 2 | Critical | Reliability    | **Unchecked file open error masks silent failure** | `cmd/importer/main.go:12` — `os.Open(os.Args[1])` error ignored. If file cannot be opened (missing, permission denied), program continues with empty rows list. | Check error and exit with informative message: `file, err := os.Open(os.Args[1]); if err != nil { fmt.Fprintf(os.Stderr, "Error: %v\n", err); os.Exit(1) }` |
| 3 | Critical | Reliability    | **Unchecked CSV parse error masks silent failure** | `cmd/importer/main.go:13` — `csv.NewReader(file).ReadAll()` error ignored. Malformed CSV silently produces zero rows; program reports success. | Check error and exit: `rows, err := csv.NewReader(file).ReadAll(); if err != nil { fmt.Fprintf(os.Stderr, "Parse error: %v\n", err); os.Exit(1) }`  |
| 4 | High     | Correctness    | **Import count report does not reflect persistence** | `cmd/importer/main.go:24` — Reports `"imported X of Y rows"` but these rows are never written to durable storage. Report claims success when data is discarded. | After implementing persistent storage (Finding #1), verify that `store.Save()` succeeds before incrementing `imported` counter. Report only rows actually persisted. |
| 5 | High     | Reliability    | **No validation of subscriber data before persistence** | `cmd/importer/main.go:17-20` — Only validates non-empty email and row length ≥3; no email format check, no duplicate detection, no invalid plan handling. | Add email regex validation, check for duplicate emails in the same import, validate plan values against a whitelist. Reject rows that fail validation with logging. |

---

## Unconfirmed Issues

**Race condition in concurrent imports**: The `store.Mutex` protects the map, but if the importer were called twice concurrently (e.g., two partners importing simultaneously) and no persistence layer exists, behavior is undefined. Not confirmed as a current issue because usage model is sequential CLI invocations. Becomes critical if persistence layer is added without concurrent-write safety.

---

## Summary

### Strengths

- **Defensive row skipping**: The importer skips rows that fail basic validation (`len(row) < 3 || row[1] == ""`) rather than failing the entire import, which is a sound design principle for handling partial bad data.
- **Clear runbook documentation**: The `docs/runbook.md` clearly instructs operators on the import procedure, reducing user error.

### Key Risks

**Finding #1 (Critical – No Persistence)** is the root cause of the reported missing subscribers. The importer reports success but discards all data when the process exits. This is a complete architectural failure that must be remedied before the tool can function.

**Findings #2 and #3 (Critical – Error Handling)** compound the problem: file and CSV errors are silently ignored, meaning failed imports appear successful. An operator cannot distinguish between a genuine successful import and a failed one.

**Finding #4 (High – Incorrect Reporting)** means the confirmation message sent to the partner is misleading; it reports row counts that were never persisted.

**Finding #5 (High – Validation)** means invalid or duplicate subscriber records are silently added to the in-memory store without audit trail or rejection feedback.

### Priority Order

1. **Implement persistent storage** (Finding #1): This is a blocker. Without it, the tool cannot function at all. Choose a backend (SQLite for simplicity, PostgreSQL for scale), add schema, and modify `Save()` and `Count()` to use it. Estimated effort: 2–4 hours.

2. **Add error handling on file and CSV operations** (Findings #2, #3): After persistence is in place, these errors will prevent silent data loss. Add error checks and exit with clear messages. Estimated effort: 30 minutes.

3. **Validate subscriber data** (Finding #5): Add email format validation, duplicate detection within the import, and plan validation. Log rejected rows. Estimated effort: 1 hour.

4. **Verify and update reporting** (Finding #4): Once persistence works, confirm that the import count reflects only rows actually saved. Update the success message to match. Estimated effort: 15 minutes.

5. **Test the import flow**: After the above fixes, manually test with sample CSV data to confirm subscribers persist across program invocations.

### Coverage Gaps

- **No test suite**: No unit or integration tests found. Cannot verify correctness of import logic, storage, or error paths without running the code.
- **No database schema or migration system**: Persistence layer was not examined because no backend exists. When added, schema versioning and migration safety will need evaluation.
- **No monitoring or logging**: The importer has no structured logging. Cannot audit imports or diagnose failures after the fact.
- **No concurrent-access control**: Not tested whether the importer can be safely run by multiple operators simultaneously or in an automated pipeline.
- **CSV format spec not documented**: No specification of required columns, data types, or constraints. Validation can only guess at rules.
- **Production metrics unknown**: Cannot assess impact on live subscribers; depends on deploy frequency and data volume, which are not available.

---

## Verification Summary

**Examined**: All code files (main.go, store.go), configuration (go.mod), and documentation (README.md, runbook.md). Enumerated directory structure and confirmed no other application code or data files present.

**Confirmed findings**: Silent data loss due to in-memory-only storage, unchecked errors on file and CSV operations, and minimal validation.

**Not confirmed but suspected**: Concurrent import safety, schema evolution needs, and production impact scale.
