# Engineering Assessment

## Scope and context

Depth: **targeted**. I enumerated and read every repository file in scope:

- `README.md`
- `go.mod`
- `cmd/importer/main.go`
- `internal/store/store.go`
- `docs/runbook.md`

This is a Go 1.22 command-line data importer. It reads partner CSV files,
validates a small subset of fields, and writes subscribers to an in-memory
map. The target platform is a local/operator-run process; no persistent
database, network service, deployment configuration, or CI configuration is
present in the enumerated repository.

## What I ran

- `go test ./...` — could not start: `/bin/bash: line 1: go: command not found`.
- `go vet ./...` — could not start: `/bin/bash: line 1: go: command not found`.
- `go build ./...` — could not start: `/bin/bash: line 1: go: command not found`.
- `command -v go`, `command -v golangci-lint`, `command -v staticcheck`,
  `command -v gofmt` — no paths were returned; these tools are unavailable.
- `git status --short` — could not run because `/workspace` is not a Git
  working tree.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Data integrity | File-open and CSV-parse failures are discarded, so an import can report success without importing the partner file. | `cmd/importer/main.go:12-13` assigns both `os.Open` and `ReadAll` errors to `_`; a missing/unreadable file leaves no controlled failure path, while line 24 still prints an import result. | Check and return/report `os.Open` and `ReadAll` errors; use a non-zero exit status and do not send a success confirmation unless parsing completed. Add tests for missing files, permission errors, and malformed CSV. |
| 2 | High | Correctness | The validation policy silently drops malformed rows, including rows with fewer than three columns, and counts them only in the denominator. This can explain subscribers “missing” after a successful run. | `cmd/importer/main.go:16-19` skips `len(row) < 3` or an empty email with no diagnostic; `README.md` confirms failed rows are skipped; line 24 presents the result as a partner-facing confirmation. | Track rejected rows with row numbers and reasons, emit a rejection report, and make the command fail or require explicit acknowledgement when the rejection rate/count is non-zero. Validate required headers, email format, and plan values. |
| 3 | High | Reliability | A successful-looking count does not prove durable import: storage is only a process-global in-memory map, so all imported subscribers disappear when the CLI exits. | `internal/store/store.go:10-13` defines `items` as an in-memory map; `Save` at lines 15-19 only mutates that map and exposes no file/database persistence. The CLI exits immediately after line 24. | Persist imports to the intended durable store within a transaction, verify the committed count, and report persistence failures. If this map is intentionally a test double, wire a real production repository and make that distinction explicit. |
| 4 | High | Reporting/correctness | The reported “imported” number counts accepted input rows, not newly stored subscribers; duplicate emails overwrite prior records while still incrementing the count. Re-running can therefore claim success while the stored subscriber count is lower. | `cmd/importer/main.go:20-21` calls `Save` then increments `imported`; `internal/store/store.go:18` assigns by email, overwriting duplicates. `docs/runbook.md:3-5` instructs operators to forward this count and rerun when it looks wrong. | Define whether the metric is rows accepted, records inserted, or records updated; have `Save` return the outcome and report inserted/updated/rejected totals separately. Detect duplicate emails within a file and according to the business policy. |
| 5 | High | Concurrency/reliability | `Count` reads the map without the mutex used by `Save`, creating a data race and possible concurrent-map failure if count/inspection is added while imports run. | `internal/store/store.go:15-19` locks writes, but `Count` at line 21 directly reads `items` without locking. | Protect reads with `RLock`/`Lock` consistently (prefer `sync.RWMutex`) and add a race-enabled concurrent test. Define whether concurrent imports are supported; otherwise enforce single-writer operation. |

## Strengths

- `Save` serializes map writes with a mutex (`internal/store/store.go:15-18`),
  which is a useful foundation if the store remains process-local.
- The importer isolates a bad row from otherwise valid rows using a clear
  per-row guard (`cmd/importer/main.go:16-19`), matching the stated requirement
  in `README.md`. The operational problem is that it provides no visibility or
  control over those rejected rows.

## Key risks

Findings 1–2 directly account for a false-success import and missing
subscribers. Findings 3–4 mean even a clean run is not a durable or accurate
partner confirmation. Finding 5 becomes material as soon as inspection or
parallel import paths use `Count`.

## Priority order

1. Stop false confirmations: handle open/parse errors and expose rejected-row
   details (findings 1–2).
2. Establish durable transactional persistence and verify committed results
   (finding 3).
3. Correct the inserted/updated/rejected accounting and duplicate policy
   (finding 4).
4. Make store reads race-safe and test concurrent behavior (finding 5).

## Coverage gaps

- No production database, partner CSV, deployment/CI configuration, runtime
  logs, or subscriber records were available, so actual data loss and the
  partner’s specific last-import failure could not be reconstructed.
- Go-based build, test, vet, formatting, and static-analysis checks could not
  run because Go tooling is not installed.
- No load, concurrency/race, integration, persistence-recovery, or
  penetration testing was performed.
- No migrations, API/authentication layer, frontend, or external-service code
  exists in the enumerated repository; those concerns were not assessed.
