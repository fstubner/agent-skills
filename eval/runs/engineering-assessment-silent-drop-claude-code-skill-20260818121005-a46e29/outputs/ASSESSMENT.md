# Engineering Assessment: Subscriber Import Tool

## Scope

**In scope:**
- `cmd/importer/main.go` — import entry point and CSV parsing logic
- `internal/store/store.go` — subscriber storage layer
- `go.mod` — dependencies
- `docs/runbook.md` — operational documentation

**Depth:** Targeted (all in-scope files read in full)

**Out of scope:**
- Build, test, and CI/CD configuration (not present in repository)
- Runtime infrastructure and deployment configuration
- Partner communication flows and SLAs
- Data recovery or backup procedures

## Environment

**Language/Runtime:** Go 1.22
**Build system:** Go modules
**Domain:** Data import tool (CLI utility)
**Key components:** CSV parser, in-memory subscriber store

## Tooling Results

**Tools attempted:**
- `go build` — not run (no permission to modify workspace, assessment only)
- `go test` — no test files found in repository
- `go fmt` / `gofmt` — not run (assessment only)
- `go vet` — not run (assessment only)

**Tools unavailable:**
- Test suite: no `*_test.go` files in repository
- Linters: no linter configuration present
- Type checking: Go compiler would catch at build time (not run here)

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Data Integrity | Subscribers stored in-memory only; no persistence layer exists | `internal/store/store.go:10-12` — `var items = map[string]Subscriber{}` with no file/database write; `cmd/importer/main.go:24` reports imported count but never persists data to disk | Implement persistent storage (file-based append log, SQLite, or database). At minimum, write imported subscribers to a file or database before reporting success. Call `Count()` after import to verify storage. |
| 2 | **Critical** | Reliability | Silent error handling on file I/O; file open and CSV parsing errors ignored | `cmd/importer/main.go:12-13` — `os.Open(os.Args[1])` and `csv.NewReader(file).ReadAll()` both use `_` for error capture with no checks; panics would occur if file missing or malformed | Add explicit error checks: `if err != nil { log.Fatal(err) }` after file open and ReadAll. Return non-zero exit code on failure so caller can detect import failure. |
| 3 | **High** | Reliability | Race condition: `Count()` reads `items` map without lock acquisition | `internal/store/store.go:21` — `Count()` accesses `items` map without holding mutex, while concurrent `Save()` calls modify it under lock | Acquire `mu.Lock()` in `Count()` before reading len(items), defer unlock. Alternatively, add atomic counter that is incremented with mutex protection. |
| 4 | **High** | Correctness | Tool reports success unconditionally despite potential data loss | `cmd/importer/main.go:24` — `fmt.Printf("imported %d of %d rows\n", imported, len(rows)-1)` printed regardless of whether data persisted or errors occurred; runbook at `docs/runbook.md` instructs operator to forward printed count as confirmation | Before printing success, verify data was saved: call `store.Count()` to confirm subscribers were stored, or check database insert result. Log/return failure if verification fails. |
| 5 | **Medium** | Architecture | No queryable audit trail or verification mechanism for imported data | `internal/store/store.go` exports only `Save()` and `Count()`; no `Get()`, `List()`, or persistence export; operator cannot verify which subscribers were imported or inspect data | Add `func List() []Subscriber` or `Export(filename string) error` to allow verification. Add import timestamp and source tracking to `Subscriber` struct for audit trail. Write imported data to queryable log file or database. |

---

## Summary

### Strengths
- CSV validation logic correctly skips invalid rows (empty email, insufficient columns) without failing entire import
- Mutex protection in `Save()` prevents basic concurrent writes to in-memory map

### Key Risks

**Why subscribers go missing:** The application stores all subscriber data in memory (`items` map in `store.go:12`) with no persistence mechanism. When the importer process exits, the in-memory map is garbage-collected and all data is lost. The tool prints a success message (imported count) that is never verified against actual storage, creating the illusion of success while data is silently discarded.

**Idempotency illusion:** Runbook claims "imports are safe to repeat," but this is only true if the data was actually persisted before re-running. Since it isn't, subsequent runs start with an empty store and re-import the same subscribers, appearing as duplicates or forcing manual deduplication logic that doesn't exist.

### Priority Order

1. **Implement persistent storage** (Critical: blocks entire product) — Data loss is the core issue. Choose a durable backend (append log, SQLite, or managed database).
2. **Add error handling for file I/O** (Critical: affects reliability) — Silent failures hide import failures. Return exit codes on errors.
3. **Fix Count() race condition** (High: data corruption risk) — Reading items map without lock can race with concurrent writes.
4. **Add verification/audit trail** (High: enables operator to detect issues) — Operator needs visibility into what was actually imported.
5. **Export/query imported data** (Medium: improves debuggability) — Current API is write-only with no inspection capability.

### Coverage Gaps

**Not examined:**
- Build verification: `go build` was not run; code may not compile
- Test coverage: no `*_test.go` files exist; no unit or integration tests present
- Actual CSV files used in production: cannot confirm row structure or edge cases
- Deployment and runtime environment: persistence storage, concurrent importer invocations, process lifecycle
- Operator runbook adherence: cannot verify if operators actually run imports or if there's an automated scheduler
- Database schema or file format: no specification for persistent storage (if added later)
- Partner SLAs or data retention policies
