# Engineering Assessment: Subscriber Importer

## Scope

**In scope:**
- `cmd/importer/main.go` — main import logic
- `internal/store/store.go` — data persistence layer
- `go.mod` — dependency configuration
- README.md and docs/runbook.md — documentation

**Out of scope:**
- External infrastructure (database, message queues, etc.) not present in this repository
- Partner CSV data validation beyond what code shows
- Production deployment configuration

**Depth:** Targeted — every file in scope was read in full.

---

## Environment

**Language and Runtime:** Go 1.22

**Domain:** CSV import utility for subscriber data

**Build System:** Go modules (go.mod)

**Key Dependencies:** None (standard library only)

---

## What I Ran

**Build Command:** Attempted `go build ./cmd/importer`
- **Result:** Build execution approval required in sandbox; not run.

**Tests:** No test files found in repository.

**Lint/Audit:** No automated checks configured (no Makefile, no CI config).

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Data Integrity | In-memory storage with no persistence causes silent data loss | `internal/store/store.go:12-13` — data stored in map `items = map[string]Subscriber{}` lives only in process memory. `cmd/importer/main.go:24` prints success, then program exits. All imported data is lost when process terminates. | Persist data to disk (SQLite, JSON file, or database) before exiting. Verify data was written before reporting success to partner. |
| 2 | High | Reliability | Unchecked file operations cause crashes with no error indication | `cmd/importer/main.go:12-13` — `os.Open()` and `csv.ReadAll()` errors both assigned to `_` are ignored. Missing file or malformed CSV will cause nil pointer panic or cryptic Go runtime error. Partner sees no output; operator unaware import failed. | Check both errors explicitly: `if err != nil { fmt.Fprintf(os.Stderr, "error opening file: %v\n", err); os.Exit(1) }` |
| 3 | High | Data Integrity | Validation failures silently dropped without indication to operator | `cmd/importer/main.go:17-19` — rows with fewer than 3 columns or empty email are skipped with `continue`. No log, no counter, no indication to operator which rows failed. Partner receives count of imported rows but doesn't know how many were rejected or why. | Log rejected rows with reason: `log.Printf("rejected row %d: %s", rowIndex, reason)`. Report both imported and rejected counts: `fmt.Printf("imported %d of %d rows; %d rejected\n", imported, total, rejected)` |
| 4 | High | Data Integrity | Duplicate emails within single CSV silently overwrite previous entries | `internal/store/store.go:18` — `items[s.Email] = s` unconditionally overwrites. If same email appears twice in CSV with different Plan values, second row silently replaces first. Runbook claims "imports are safe to repeat" but single-import duplicates cause loss. | Detect and reject or merge duplicates: detect before Save, either error on duplicate or merge plans. Track duplicates in rejected count. |
| 5 | Medium | Reliability | No validation of email format or Plan values | `cmd/importer/main.go:17` — only checks `row[1] != ""` and slice length. No validation that `row[1]` is valid email format, `row[2]` is valid plan (e.g., against allowed list). Invalid data silently enters store. | Add validation: check email format with regex or email parser; validate Plan against known values (e.g., "basic", "premium"); reject invalid rows with reason logged. |

---

## Unconfirmed Issues

None. All findings above are confirmed by direct code examination.

---

## Summary

### Strengths

- **Modular structure**: Separation between main import logic (cmd/importer) and storage layer (internal/store) allows for cleaner testing and replacement of storage backend.
- **Mutex protection in store**: The use of `sync.Mutex` in the store prevents concurrent access corruption, showing awareness of concurrent access concerns.

### Key Risks

The system has a fundamental architecture problem (findings #1, #2, #3, #4): **imported data is never persisted**, error handling is absent, and validation is silent. This directly matches the partner's report: "subscribers are missing after import despite success message."

**Reproducer pathway:**
1. Partner sends CSV with subscriber data.
2. Operator runs `importer partner.csv`.
3. Program prints "imported 100 of 100 rows" (finding #1 — data only in memory).
4. Program exits (finding #1 — data lost).
5. Operator forwards success message to partner.
6. Partner expects 100 new subscribers in system, but finds 0 (finding #2 — no indication of failure to persist).

Finding #3 (silent rejections) and #4 (duplicate overwrites) compound the issue: operator has no visibility into whether rows were actually accepted.

### Priority Order

1. **Add persistent storage** (finding #1) — Move data from in-memory map to durable store before process exit. This is the root cause of the missing subscribers issue.
2. **Add error handling to file operations** (finding #2) — Wrap os.Open and csv.ReadAll with explicit error checks and early exit. Prevents crashes and ensures operator is informed of failure.
3. **Log validation rejections** (finding #3) — Add rejected row counter and log reasons. Gives operator visibility into import quality.
4. **Handle duplicate emails** (finding #4) — Detect within-CSV duplicates and either reject or merge explicitly. Prevents silent data loss from overwrites.
5. **Validate data format** (finding #5) — Add email and plan validation. Prevents garbage data entering the store.

### Coverage Gaps

- **No tests**: No test files exist. Cannot verify import logic under edge cases (empty CSV, malformed rows, duplicate emails).
- **No database schema**: No information on how/where data should be persisted long-term or what schema the subscriber table should have.
- **No network/API integration**: Cannot assess how imported data flows downstream; partner notification mechanism unknown.
- **No production metrics**: Unknown whether this tool is currently in use, how many subscribers it has imported historically, or what the actual impact of finding #1 has been.
- **No deployment config**: No CI/CD, no way to run automated checks on changes.
- **No error logging framework**: System has no structured logging, only fmt.Printf, limiting troubleshooting capability.
