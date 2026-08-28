# Engineering Assessment

## Scope and context

Depth: targeted. I enumerated and read every repository file in scope:

| Directory | Files |
|---|---|
| `.` | `README.md`, `go.mod` |
| `cmd/importer` | `main.go` |
| `internal/store` | `store.go` |
| `docs` | `runbook.md` |

This is a Go 1.22 command-line CSV subscriber importer. It reads a partner
file, validates rows, and writes subscribers to an in-process store. The
documented platform is an operator-run CLI; no external database or service
is configured in the repository.

## What I ran

The repository declares Go 1.22 in `go.mod`. I attempted the applicable build,
test, and static-check commands:

| Command | Result |
|---|---|
| `go test ./...` | Could not start: `/bin/bash: line 1: go: command not found` |
| `go vet ./...` | Could not start: `/bin/bash: line 1: go: command not found` |
| `go build ./...` | Could not start: `/bin/bash: line 1: go: command not found` |

No project lint, audit, or CI command is declared in the files inspected.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Data integrity | Successful imports are not persisted; all subscribers disappear when the process exits. | `internal/store/store.go:10-13` defines the entire store as a package-global map, and `store.Save` at `15-19` only updates that map. There is no file/database write or load path. The CLI exits after printing at `cmd/importer/main.go:24`. | Persist subscribers in a durable datastore or explicitly durable file, load existing state at startup, and make the import confirmation depend on the durable write succeeding. Add a restart/recovery test. |
| 2 | High | Reliability | File-open and CSV-read failures are discarded, allowing an invalid or missing import to report success (and potentially panic on a missing argument). | `cmd/importer/main.go:12-13` assigns `_` to both `os.Open` and `ReadAll` errors. `os.Args[1]` is accessed without checking `len(os.Args)` at line 12. | Validate the argument count; handle and report `os.Open` and `ReadAll` errors; close the file; return a non-zero exit code and do not emit success output on failure. |
| 3 | High | Correctness | Row validation is incomplete: any non-empty second column is accepted, while the plan column is not validated, normalized, or checked for supported values. | `cmd/importer/main.go:17` checks only `len(row) < 3 || row[1] == ""`; line 20 saves `row[1]` and `row[2]` directly. The README says invalid rows are skipped (`README.md:3-4`), but the implementation has no email-format or plan validation. | Define the CSV schema and supported plans, validate and trim email/plan values before saving, count rejected rows, and report rejection reasons or a bounded error summary. |
| 4 | High | Reliability | The reported “imported” count is not a count of subscribers actually added or retained, so confirmation can claim success while records were overwritten or not durably stored. | `cmd/importer/main.go:20-21` increments `imported` for every accepted input row regardless of `Save` outcome or whether the email already exists. `Save` overwrites by email at `internal/store/store.go:18`; the runbook nevertheless says repeat imports are safe and tells operators to forward the count (`docs/runbook.md:3-5`). | Have the store return an explicit result (created/updated/rejected/error), aggregate those results, and report input, accepted, created, updated, and rejected counts. Make the confirmation reflect durable transaction completion. |
| 5 | Medium | Concurrency / correctness | `Count` reads the shared map without the mutex used by `Save`, creating a data race and possible fatal concurrent-map access if called while importing. | `internal/store/store.go:15-18` locks around map writes, but `Count` at line 21 directly executes `len(items)` without locking. | Protect `Count` with the same mutex or use a concurrency-safe store; add a race-enabled test that calls `Save` and `Count` concurrently. |

## Strengths

- `Save` serializes map writes with a mutex (`internal/store/store.go:15-18`),
  which is a sound foundation for concurrent writes.
- The importer isolates row acceptance from the loop and reports both accepted
  and total data-row counts (`cmd/importer/main.go:15-24`), matching the
  intended operator workflow described in `README.md:3-4`.

## Key risks

Finding 1 explains subscribers missing after a command that reported success:
the success message is only process-local accounting. Findings 2-4 can also
produce false confirmations or silently accept bad data, so they should be
addressed together with persistence and durable result reporting.

## Priority order

1. Add durable storage and verify data survives process restart (Finding 1).
2. Stop ignoring argument, file, and CSV errors (Finding 2).
3. Define and enforce the partner CSV schema (Finding 3).
4. Report durable create/update/reject outcomes rather than loop iterations (Finding 4).
5. Make all store access synchronized and run the race test (Finding 5).

## Coverage gaps

- Runtime tests, build, vet, and race testing could not be performed because
  the Go toolchain is not installed in this environment.
- No production database, deployment configuration, partner sample CSV,
  logs, metrics, or import history was available, so the observed production
  incident could not be replayed end-to-end.
- No load, crash-recovery, penetration, compatibility, or filesystem/database
  durability testing was performed.
- Files under `.agent-input` were used only for workflow instructions; no
  evaluation cases, graders, expected answers, or sibling run outputs were
  inspected.
