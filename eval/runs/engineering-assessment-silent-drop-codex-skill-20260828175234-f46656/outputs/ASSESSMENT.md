# Engineering Assessment

## Scope and context

Depth: targeted. I enumerated and read the complete repository application and
documentation files: `README.md`, `cmd/importer/main.go`,
`internal/store/store.go`, `docs/runbook.md`, and `go.mod`.

This is a Go 1.22 command-line CSV importer. It reads partner files, performs
minimal row validation, and stores subscribers in an in-memory map.

## What I ran

- `go test ./...` — could not start: `/bin/bash: line 1: go: command not found`.
- `go build ./...` — could not start: `/bin/bash: line 1: go: command not found`.
- `go vet ./...` — could not start: `/bin/bash: line 1: go: command not found`.
- `gofmt -l .` — could not start: `/bin/bash: line 1: gofmt: command not found`.

No automated test, build, lint, or static-analysis result was available.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Data integrity | Imported subscribers are not persisted. A successful process loses the entire import when it exits or restarts. | `internal/store/store.go:10-13,15-18` — `items` is a package-level map and `Save` writes only to that map; there is no file/database/network persistence. `cmd/importer/main.go:11-25` exits after printing the count. | Introduce durable storage with an explicit schema and commit/error path; only report success after the committed records can be read by a later process. Add a restart/reopen integration test. |
| 2 | High | Reliability | File-open and argument failures are ignored, so an invalid invocation can panic or produce no meaningful partner-facing failure. | `cmd/importer/main.go:12` indexes `os.Args[1]` without checking argument count and discards `os.Open`’s error; `:13` passes the resulting file to `csv.NewReader` while discarding `ReadAll`’s error. | Validate the argument count, check `os.Open`, defer `Close`, and return a non-zero exit status with an actionable error before processing. |
| 3 | High | Data integrity | CSV parse failures are not surfaced and can result in a partial import being reported as successful. | `cmd/importer/main.go:13-24` ignores the `ReadAll` error, then processes whatever rows were returned and prints `imported ...` unconditionally. A truncated or malformed CSV therefore has no failure signal. | Treat any CSV read/parse error as an unsuccessful import; stage records and commit only after the complete file is parsed, or clearly report partial completion with the error and committed count. |
| 4 | High | Correctness | Duplicate email rows overwrite prior subscribers while the success count still increments for every row, so data can be missing while the confirmation count looks healthy. | `internal/store/store.go:18` assigns `items[s.Email] = s`, making email the implicit unique key and replacing an earlier row; `cmd/importer/main.go:20-24` increments and reports `imported` for each input row without checking replacement. | Define duplicate semantics explicitly: reject/report duplicates or upsert with separate inserted/updated counts. Make the confirmation count reflect durable unique records and add duplicate-row tests. |
| 5 | Medium | Correctness | Validation is too weak to guarantee a valid subscriber record: empty plans are accepted and the header is assumed rather than validated. | `cmd/importer/main.go:16-20` skips only rows with fewer than three columns or an empty `row[1]`; it saves `row[2]` even when empty and never checks `rows[0]` or field names. | Validate the required header and all required fields (including the plan and email format), report rejected-row reasons, and test missing/shifted columns. |

## Strengths

- `store.Save` serializes map writes with a mutex (`internal/store/store.go:15-18`),
  preventing concurrent write corruption within one process.
- The importer deliberately continues past rows failing its current basic
  checks (`cmd/importer/main.go:16-21`), matching the documented goal that one
  bad row should not abort the whole import (`README.md:3-5`).

## Key risks

Finding 1 explains the partner’s missing subscribers after a reported success:
the reported count describes work done in one process, not data that survives
the command. Findings 3 and 4 can additionally produce incomplete or
under-counted results without an unsuccessful confirmation.

## Priority order

1. Add durable, transactional persistence and verify it across process restart (1).
2. Fail safely on file, argument, and parse errors; prevent partial-success reporting (2, 3).
3. Define and report duplicate/upsert behavior (4).
4. Strengthen schema and field validation (5).

## Unconfirmed / Requires Investigation

- The partner’s actual CSV contents, command invocation, and runtime logs were
  unavailable, so the specific trigger for their last import cannot be
  distinguished among the confirmed failure modes above.

## Coverage Gaps

- Go build, tests, vet, and formatting checks could not be run because the Go
  toolchain is not installed in this environment.
- No production database, deployment configuration, scheduler, partner CSV,
  runtime logs, or operational metrics were present in the repository.
- No load, concurrency, recovery, end-to-end, penetration, or persistence
  integration testing was performed.
- The `.agent-input` workflow instructions were used, but their supporting
  evaluation material was not examined.

