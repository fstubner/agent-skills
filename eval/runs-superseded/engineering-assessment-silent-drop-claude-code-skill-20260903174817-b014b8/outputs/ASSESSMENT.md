# Engineering Assessment: Subscriber Importer

## Scope

**In scope**: 
- All Go source code in `cmd/importer/` and `internal/store/`
- Project documentation in `docs/` and `README.md`
- Data storage and persistence mechanism

**Out of scope**:
- External database systems or infrastructure
- Partner CSV file formats beyond what the code specifies
- Production deployment or operational procedures
- Load testing or performance benchmarks

**Depth**: Targeted — all source files in scope were read in full.

---

## Environment

**Language & Runtime**: Go 1.22

**Frameworks & Libraries**: Standard library only (os, encoding/csv, fmt, sync)

**Domain**: Data import utility — imports subscriber records from CSV files

**Build System**: Go module (`go.mod`)

**Tooling Status**:
- Could not run build/test (user did not authorize shell commands)
- No tests found in codebase
- No automated checks configured

---

## Tooling Results

**What I ran**: None (build authorization not granted; no test suite present to run)

**Tools that failed to run**: `go build`, `go test` (authorization required)

**Tools unavailable**: No test files, lint config, or CI configuration present

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Data Integrity | No persistence mechanism; all subscriber data is stored only in RAM and lost when the program exits | `internal/store/store.go:12` — `var items = map[string]Subscriber{}` is a package-level map with no backing storage to disk or database. Data exists only during program execution. | Implement persistent storage: write imports to a database (SQLite, PostgreSQL, etc.) or durable file format. Update `Save()` to persist each record immediately or buffer and commit in a transaction. |
| 2 | **High** | Reliability | Unhandled file I/O errors allow silent failures while reporting false success | `cmd/importer/main.go:12–13` — `file, _ := os.Open(os.Args[1])` and `csv.NewReader(file).ReadAll()` both discard errors. If the file doesn't exist or CSV is malformed, the program prints "imported 0 of 0 rows" with no indication of failure. | Add explicit error checks: `if err != nil { log.Fatal(...) }` after both os.Open and ReadAll. Distinguish between file-not-found, parse errors, and other failures in the error message. |
| 3 | **High** | Reliability | Missing argument validation causes panic on missing input | `cmd/importer/main.go:12` — No check for `len(os.Args)` before accessing `os.Args[1]`. Running `importer` with no filename argument panics with "index out of range". | Add guard: `if len(os.Args) < 2 { log.Fatal("Usage: importer <csv-file>") }` at the start of `main()`. |
| 4 | **High** | Correctness | False success reporting misleads operators and contradicts documentation | `cmd/importer/main.go:24` reports "imported X rows" based on in-memory saves, but `docs/runbook.md` states "imports are safe to repeat" and implies data persists. Operator sees the count and believes import succeeded, but no data was ever saved. Runbook then recommends re-running if "count looks wrong". | Update runbook to clarify that data is not persistent. Alternatively, if persistence is implemented (finding #1), the success message becomes accurate. Until then, issue a warning: "Warning: imported data is not persisted" in each output. |
| 5 | **Medium** | Data Integrity | Incomplete CSV validation allows malformed or missing required fields to be silently skipped or partially accepted | `cmd/importer/main.go:17–20` validates only `len(row) < 3` and `row[1] != ""`. Does not validate email format, plan validity, required fields, or unexpected column counts. First column (row[0]) is read but never used; intent unclear. | Define and enforce schema validation: validate email format (e.g., with regexp or email parser), restrict Plan to a known set of values, and reject rows with unexpected column counts. Log skipped rows with reason (e.g., "invalid email", "unknown plan"). |

---

## Unconfirmed Issues

None. All findings above are confirmed by direct code inspection.

---

## Summary

### Strengths

- **Simple, focused module structure**: Clear separation between importer logic (`cmd/importer/main.go`) and storage layer (`internal/store/store.go`) with a clean `Subscriber` struct (`internal/store/store.go:5–8`). Easy to understand at first reading.
- **Thread-safe in-memory storage**: The store properly uses `sync.Mutex` to protect concurrent access to the subscribers map (`internal/store/store.go:11, 16`), preventing data races within the current process.

### Key Risks

**Finding #1 (Critical: No persistence)** is the root cause of the reported problem. Subscribers imported via this tool exist only in RAM. Once the program exits, all data is lost. The operator receives a success message, but the data never reaches any durable store. This explains why "subscribers are missing after their last import."

**Findings #2 and #3 (High: Unhandled errors, missing validation)** compound the problem by allowing silent failures and crashes that further mask data loss or usage errors.

**Finding #4 (High: False success reporting)** makes the data loss invisible: the operator trusts the "imported X rows" message without realizing no persistence occurred.

### Priority Order

1. **Implement a persistent storage layer** (Finding #1). Until data is written to a database or durable file, the importer cannot fulfill its purpose. This is the foundational fix that unblocks all other improvements.

2. **Add error handling for file I/O** (Finding #2). Prevents silent failures that mask missing input or malformed CSVs.

3. **Validate command-line arguments** (Finding #3). Stops crashes on missing filename and improves user experience.

4. **Update documentation** (Finding #4) to reflect actual behavior, or implement persistence so documentation becomes accurate.

5. **Strengthen input validation** (Finding #5). Once persistence is in place, robust validation prevents corrupted or incomplete data from being stored.

### Coverage Gaps

- **No test suite**: No unit or integration tests found. Cannot verify behavior under edge cases (empty CSV, malformed rows, concurrent writes, large files).
- **No runtime execution**: Did not run the built importer against sample CSV files to observe actual behavior (user authorization not granted).
- **No schema definition**: Expected CSV format (header row, column names, field types, constraints) is inferred from code but not explicitly documented.
- **No performance or load testing**: Cannot assess scalability or memory impact under large imports.
- **No database or file-system infrastructure**: Did not examine external storage systems; assessment covers only application code.
- **No deployment or operational context**: Did not review how the tool is invoked, monitored, or recovered from in production.

---

## What I Verified

I read the complete Go source code (`cmd/importer/main.go` and `internal/store/store.go`), project configuration (`go.mod`), and user-facing documentation (`README.md`, `docs/runbook.md`). The analysis identified that all imported subscriber data is stored exclusively in a Go map that exists only in RAM, with no persistence to disk or database. This is the direct cause of missing subscribers: they are loaded into memory during the import run, reported to the user as successfully imported, and then lost when the program exits. The assessment identified four additional high-severity issues (error handling, validation, and misleading documentation) that mask or enable this core failure.
