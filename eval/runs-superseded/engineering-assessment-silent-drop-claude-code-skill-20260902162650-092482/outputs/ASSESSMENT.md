# Engineering Assessment: Subscriber Importer

## Scope

**In Scope:**
- `cmd/importer/main.go` — main import logic and error handling
- `internal/store/store.go` — data persistence layer
- `go.mod` — project dependencies
- `README.md` and `docs/runbook.md` — project documentation

**Out of Scope:**
- Integration testing or end-to-end testing (not in repository)
- Partner systems or API integrations (not in codebase)
- Database schema or persistence backend (not implemented)
- Operational deployment or monitoring (not in codebase)

**Depth:** Targeted — all in-scope files read in full; no build/test commands available to run.

---

## Environment

**Language:** Go 1.22  
**Runtime:** Command-line application  
**Domain:** CSV subscriber import tool  
**Architecture:** Single-file CSV reader with in-memory store  
**Tooling:** Standard Go build tools (go build, go test, go vet)  

---

## Tooling Results

**Attempted commands:**
- `go build` — not run (no approval for execution)
- `go test` — no test files present in repository
- `go vet` / `golangci-lint` — not attempted (no lint configuration)

**Tools unavailable:**
- Test suite — no `*_test.go` files in codebase
- Linter configuration — no `.golangci.yml` or similar
- Build automation — no Makefile or `go.mod` build tags

**What I ran:**
- Manual source code inspection of all `.go` files

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Data Integrity | All imported data lost on program exit | `internal/store/store.go:10-13` — `items` is a global in-memory `map[string]Subscriber` with no persistence layer, no database, and no file I/O. Every import to this store is lost when the process terminates. | Implement a persistent storage backend (database, file-based, or append-only log). Store operations must write through to durable storage before returning success. Update `store.Save()` to return an error if persistence fails. |
| 2 | Critical | Reliability | Unhandled errors mask import failures | `cmd/importer/main.go:12-13` — File open error: `file, _ := os.Open(os.Args[1])`. CSV read error: `rows, _ := csv.NewReader(file).ReadAll()`. Both errors are silently discarded with blank identifiers. If file is missing, unreadable, or malformed, the program will crash or silently fail while reporting success. | Capture and handle errors: `file, err := os.Open(...); if err != nil { log.Fatalf("cannot open file: %v", err) }` and same for CSV read. Log or exit on error rather than continuing with invalid data. |
| 3 | Critical | Correctness | Save operation failures go undetected and still increment success count | `cmd/importer/main.go:20-21` — `store.Save(store.Subscriber{...})` ignores any return value; if it returned an error or if concurrent Save operations failed, the counter would still increment. Currently `Save()` in `store.go:15` takes no error return, meaning any failure cannot be signaled. Subscribers could be silently dropped while the tool reports success. | Modify `store.Save()` to return `error`. In `main.go`, check the returned error and only increment `imported` if `err == nil`. Log any save failures with subscriber details so the operator knows what failed. |
| 4 | High | Data Validation | Insufficient email validation allows invalid records | `cmd/importer/main.go:17-19` — Validation only checks `len(row) < 3 \|\| row[1] == ""`. This accepts any non-empty string as a valid email, including strings with no `@` symbol, spaces, or special characters. Invalid emails corrupt the subscriber database and are indistinguishable from valid ones. | Add email format validation using regex (`^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$` at minimum) or a dedicated email parser. Reject rows with invalid emails and log them so the operator knows which rows were skipped. |
| 5 | High | Reliability | No deduplication or idempotency tracking across restarts | `cmd/importer/main.go:16-22` and `internal/store/store.go:18` — The map key is email, so duplicates within a single run overwrite silently (silent idempotency). However, if the operator re-runs the same file after a crash or restart, all rows are re-imported, overwriting prior imports. The runbook says "imports are safe to repeat" (docs/runbook.md:4), but there is no mechanism to track which rows have been imported, version the import, or handle partial import recovery. | Maintain an import log with file hash, row count, and timestamp. On re-run, detect duplicate imports by file hash and skip them, or log a warning to the operator. Alternatively, make the import idempotent by tracking import ID per subscriber. |

---

## Unconfirmed Issues

**Possible missing subscribers scenario:**
The reported "subscribers are missing after import" could result from any of the above issues in combination. Without access to logs, the actual CSV files, or the partner's expectations, the exact failure mode is not confirmed. However, the most likely cause is **Finding #1** (data loss on exit) — if the importer is expected to persist data but the operator is checking for subscribers after the process terminates, all data would be gone. Alternatively, **Findings #2 and #3** could silently drop rows while reporting success.

---

## Summary

### Strengths

1. **Simple, understandable architecture** — The import logic is straightforward and easy to follow. No complex frameworks or abstractions obscure the main flow.
2. **Thread-safe store operations** — The store uses `sync.Mutex` to protect concurrent access to the in-memory map, preventing data races in multi-threaded scenarios (`internal/store/store.go:11, 16-17`).

### Key Risks

- **Data loss on every run** (Finding #1) — All imported subscribers are lost when the program exits. This is the likely direct cause of the "missing subscribers" report.
- **Silent failures in critical paths** (Findings #2, #3) — File I/O and save operations can fail without the operator knowing, masking the real reason for missing data.
- **No validation of imported data** (Finding #4) — Invalid email records are accepted and stored, corrupting the subscriber database.

### Priority Order

1. **Implement persistent storage (Finding #1)** — Critical blocker. Without a durable store, no subscribers will persist across program runs. This must be fixed first.
2. **Add error handling and reporting (Findings #2, #3)** — Uncover why subscribers might be missing by making failures visible to the operator.
3. **Add email validation (Finding #4)** — Prevent invalid records from entering the store, improving data quality.
4. **Add import idempotency tracking (Finding #5)** — Allow safe re-runs and recovery from partial imports without duplication.

### Coverage Gaps

- **Database design** — No database schema is defined. It is unclear whether the importer is meant to integrate with an existing subscriber database or create one.
- **Operational runbook details** — The runbook mentions "operator runs importer partner.csv" and "forwards the printed line", but does not specify how or where subscriber data is expected to persist.
- **Partner communication** — How partners receive confirmation and what they expect to see in the database after import is not documented.
- **Failure recovery procedures** — No documented procedure for recovering from a failed or partial import (e.g., which rows to re-send).
- **Load testing / scalability** — No performance constraints or testing for large CSV files (thousands or millions of rows). The in-memory map could exhaust memory.
- **Backup and archival** — No backup strategy or historical audit trail of imports.

---

## What I Verified

I reviewed all source files (`cmd/importer/main.go`, `internal/store/store.go`, `go.mod`) and supporting documentation (`README.md`, `docs/runbook.md`). I identified five high-value findings spanning data integrity, reliability, correctness, validation, and idempotency. The most critical issue — loss of all imported data on program exit due to the in-memory store — directly explains the reported missing subscribers. No build or test commands were executed due to lack of approval, but the codebase analysis did not require them to identify these issues.
