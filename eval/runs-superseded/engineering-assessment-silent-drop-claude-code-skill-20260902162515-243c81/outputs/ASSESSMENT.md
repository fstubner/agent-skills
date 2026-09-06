# Engineering Assessment: Subscriber Importer

## Scope

**In scope**: 
- Application logic: `cmd/importer/main.go` (entry point and CSV parsing)
- Data persistence layer: `internal/store/store.go` (subscriber storage)
- Configuration: `go.mod`, `README.md`, `docs/runbook.md`

**Out of scope**: 
- External database configuration, environment setup, or deployment infrastructure
- Partner-facing UI or reporting systems beyond the CLI output
- Historical import audit logs or monitoring systems

**Depth**: Targeted — all in-scope files were read in full; automated build/test commands attempted.

---

## Environment

**Language & Runtime**: Go 1.22  
**Framework**: Standard library only (encoding/csv, os, sync)  
**Domain**: CLI tool for batch subscriber import from CSV  
**Platform**: Command-line application; data stored in-process memory  
**Build System**: Go modules (go.mod); no build script defined  

---

## What I Ran

| Check | Command | Result |
|-------|---------|--------|
| Go build | `go build ./cmd/importer` | **Skipped** — insufficient permissions to execute; no build output available |
| Go test | `go test ./...` | **Skipped** — no test files present in repository |
| Go mod tidy | `go mod tidy` | **Skipped** — insufficient permissions |
| Lint | `golangci-lint` / `go fmt` | **Skipped** — insufficient permissions |

**Note**: Build and test execution were blocked by permission restrictions. Code analysis proceeds from source reading only.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Data Integrity | Subscribers not persisted—all imported data lost on program exit | `internal/store/store.go:10-13` — global `items` map is in-memory only with no persistence layer. `cmd/importer/main.go:20` imports rows into this map; on program exit, data is completely lost. Explains reported success with missing subscribers. | Implement persistent storage: write imported subscribers to a database (SQL) or file (JSON/binary) before program exit. Add a Load() function to retrieve previously imported subscribers on startup. |
| 2 | **High** | Reliability | Unhandled file I/O errors cause silent failures or panics | `cmd/importer/main.go:12` — `os.Open(os.Args[1])` error ignored with blank assignment. If file does not exist or cannot be read, `file` is nil and subsequent operations will panic or hang. CSV parse errors at line 13 also ignored. | Replace blank assignments with explicit error handling: check if file is nil, log/report error message to user, and exit cleanly. Wrap file operations in `defer file.Close()` and handle CSV parsing errors. |
| 3 | **High** | Reliability | Missing command-line argument causes panic | `cmd/importer/main.go:12` — accesses `os.Args[1]` without bounds checking. If run without arguments, will panic with array index out of bounds. Program does not validate argument count or provide usage message. | Add bounds check: `if len(os.Args) < 2 { fmt.Fprintf(os.Stderr, "usage: importer <csv-file>\n"); os.Exit(1) }` before accessing `os.Args[1]`. |
| 4 | **High** | Resource Management | Opened file never closed | `cmd/importer/main.go:12` — file opened with `os.Open()` but never explicitly closed. Under load or with large files, this will leak file descriptors until OS limit is hit. | Add `defer file.Close()` immediately after successful open to ensure file handle is released. |
| 5 | **High** | Correctness | Validation failures silently discarded without logging | `cmd/importer/main.go:16-22` — rows with `len(row) < 3` or empty email silently skipped; no indication to user which rows failed or why (e.g., missing fields, invalid format). Partner cannot know which subscriber records were rejected. | Add logging or error summary: track rejected rows with reasons and either print a count of skipped rows or write rejected records to a separate error file so the partner can see what failed and resubmit if needed. |

---

## Summary

### Root Cause of Missing Subscribers

The importer stores all subscribers in a global in-memory map (`internal/store/store.go:12`) with no persistence mechanism. When the import process completes and the program exits, all data is lost. This is why the tool can report "imported 100 rows" but those subscribers are gone when checked later.

### Strengths

- **Validation strategy is sensible**: The approach to skip invalid rows rather than failing the entire import is correct per the README specification. Duplicate-prevention via email-based keys (store.go:18) is sound.
- **Concurrency safety**: The use of `sync.Mutex` in the store package shows awareness of concurrent access, though it's moot if data isn't persisted.

### Key Risks

1. **Data loss on every run** (Finding #1) — Critical and active. Imported data never survives beyond program exit. This is not a hidden failure mode; it is the documented behavior—and incorrect for a subscriber import system.

2. **Error handling creates brittle operation** (Findings #2, #3, #4) — Operators have no visibility into failures. Missing file, malformed CSV, or too many open files will result in unclear behavior or panics.

3. **Silent validation loss** (Finding #5) — Partners cannot diagnose why some subscribers were not imported, making support painful and repeat imports unreliable.

### Priority Order

1. **Implement persistent storage** (Finding #1) — Must be fixed before any production use. Add database or file-based persistence and a Load() function.
2. **Add error handling and argument validation** (Findings #2, #3) — Prevents operator confusion and crashes. Quick wins.
3. **Add file cleanup** (Finding #4) — Prevents resource leaks under sustained use.
4. **Log rejected rows** (Finding #5) — Improves debuggability and partner experience.

### Coverage Gaps

- **No build or test execution** — Go compiler, tests, and lint tools could not be run due to permission constraints. Potential runtime errors (missing imports, type errors) were not detected.
- **No database configuration examined** — If a database backend is intended to exist, no initialization code or schema was found in this repository. Assumed this is the issue, but no deployment docs or environment setup examined.
- **No CSV format documentation** — The expected column order (email in [1], plan in [2]) is inferred from code; no schema or examples provided. Validation logic at lines 17–18 is rigid and may reject valid rows.
- **No integration or load testing** — Concurrent import behavior, large file handling, and resource limits not tested.
- **Partner communication not audited** — The printed output is the only feedback mechanism; no email, logging, or structured reporting systems examined.

