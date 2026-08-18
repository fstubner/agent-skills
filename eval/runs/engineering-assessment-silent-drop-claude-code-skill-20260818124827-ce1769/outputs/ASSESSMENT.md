# Engineering Assessment: Subscriber Importer

## Scope

**In scope:**
- cmd/importer/main.go — entry point and CSV parsing logic
- internal/store/store.go — data storage implementation
- go.mod — project configuration and dependencies
- docs/runbook.md — operational instructions

**Out of scope:**
- Any database schemas or migrations (not present in repository)
- Integration with external systems or APIs
- Deployment infrastructure or configuration
- Performance testing or load testing

**Depth:** Targeted (all in-scope files read in full)

---

## Environment

**Language and Runtime:** Go 1.22  
**Build System:** Standard Go build (`go build`)  
**Domain:** CSV data import tool for subscriber management  
**Platform Target:** Server/CLI tool  
**Key Dependencies:** None declared in go.mod (stdlib only)

---

## What I Ran

**Attempted commands:**
- `go build -o importer cmd/importer/main.go` — Not executed (read-only analysis per task constraints)
- `go test ./...` — No test files present in repository

**Tools unavailable:**
- Unit test suite — No *_test.go files found
- Linters — No configuration for golangci-lint, go vet, etc.
- Static analysis — Could not run security scanners

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Data Integrity | In-memory storage loses all imported data when process terminates | `internal/store/store.go:10-12` — global `items` map exists only in process memory; `main.go:11-25` calls Store.Save() but no persistence layer | Implement persistent storage (database connection, file-based store, or similar). All imported subscribers must survive process restart. Update Store interface to handle persistence. |
| 2 | **High** | Correctness | Unhandled file I/O errors cause silent failures and misleading success reports | `main.go:12` os.Open() ignores errors; `main.go:13` csv.ReadAll() ignores errors — malformed files or permission errors silently result in "imported 0 of 0 rows" with exit code 0 | Add explicit error handling: check os.Open() error before calling csv.NewReader(); check csv.ReadAll() error; return non-zero exit code on file/parse errors. Print error message to stderr. |
| 3 | **High** | Reliability | Validation failures are silent; rows disappear without explanation | `main.go:17-18` rows with len < 3 or empty email are skipped with no log/warning. Partner receives "imported 42 of 50 rows" but has no way to identify which 8 rows failed or why | Log each skipped row with reason (too few columns / empty email). Optionally write rejected rows to stderr or a separate report file so partner can investigate discrepancies. |
| 4 | **High** | Robustness | Missing command-line argument causes panic at runtime | `main.go:12` accesses `os.Args[1]` without length check — if user runs `importer` with no CSV path, program panics with "index out of range" | Add bounds check: `if len(os.Args) < 2 { fmt.Fprintf(os.Stderr, "usage: importer <csv-file>\n"); os.Exit(1) }` before accessing os.Args[1]. |
| 5 | **Medium** | Correctness | Incomplete input validation allows invalid data | `main.go:20` only validates row length and email presence, not format; saves any string to Subscriber.Email and Plan fields | Add validation: check Email matches a basic email regex (e.g., `^\S+@\S+\.\S+$`), reject rows with empty Plan, log/skip invalid rows. Prevents garbage data from entering the store. |

---

## Unconfirmed Issues

**Potential race condition in concurrent imports:**  
If two `importer` processes run simultaneously on the same dataset (as the runbook suggests "run it again if count looks wrong"), the in-memory store has no way to coordinate. However, without persistent storage, this is moot — each process has its own isolated memory.

---

## Summary

### Strengths

1. **Simple, focused tool design** — The importer cleanly separates CSV parsing (main.go) from storage (store.go), making the logic easy to follow.
2. **Graceful row skipping** — Skipping invalid rows rather than failing the entire import prevents one bad row from blocking the whole file, as documented in the README.

### Key Risks

**Finding #1 (Critical)** is the root cause of the reported issue. Subscribers are "missing" because they are never persisted—they exist only in the process's memory and are lost immediately after `importer` exits. The tool reports success ("imported 50 of 50 rows"), but the subscribers do not actually exist in any persistent store.

Findings #2–#4 amplify this problem: errors in file operations are silently ignored (users believe import succeeded when it may have failed), validation failures are not reported (users cannot diagnose why row counts don't match), and missing argument handling causes crashes.

**Finding #5** allows invalid data to be imported, compounding trust issues if subscribers later fail downstream validation.

### Priority Order

1. **Finding #1 — Implement persistent storage** (Critical, blocks operational use)  
   Prerequisite for any reliable import workflow. Until subscribers persist, the tool cannot fulfill its purpose.

2. **Finding #4 — Add command-line argument validation** (High, immediate crash risk)  
   Prevents runtime panic. Quick fix with high visibility impact.

3. **Finding #2 — Add file I/O error handling** (High, enables correct failure reporting)  
   Operators need to distinguish successful imports from failed ones. This unblocks reliable operation.

4. **Finding #3 — Log validation failures** (High, enables debugging)  
   Gives partners visibility into why row counts don't match, reducing support burden.

5. **Finding #5 — Validate email and plan fields** (Medium, data quality)  
   Prevents bad data from entering the system. Can be deferred until findings #1–#3 are resolved.

### Coverage Gaps

- **Database schema or persistence backend:** Not specified anywhere. Unknown whether a database exists and should be integrated, or if a new persistence layer (SQLite, PostgreSQL, file-based) should be added.
- **Test suite:** No unit tests or integration tests present. Cannot verify correct behavior through automated checks.
- **Retry logic and idempotency:** Runbook mentions "imports are safe to repeat," but no deduplication or idempotency mechanism is visible in the code (e.g., checking if subscriber already exists before inserting).
- **Performance and scalability:** No load testing, concurrency limits, or memory profiling. Unknown if the in-memory map can handle 10K+ subscribers.
- **Monitoring and alerting:** No logging framework, no metrics collection, no way to alert operators to failures.
- **CSV format specification:** Unclear what columns are expected beyond email and plan; no schema validation or documentation.

---

## Verified Facts

✓ Verified in-memory storage with no persistence layer (store.go:10-12)  
✓ Verified unhandled errors on file open and CSV parse (main.go:12-13)  
✓ Verified silent skipping of invalid rows (main.go:17-19)  
✓ Verified missing argument bounds check (main.go:12)  
✓ Verified minimal validation (only length and empty-string checks)  
✓ Confirmed no persistent storage backend exists in repository  
✓ Confirmed no test files present  
