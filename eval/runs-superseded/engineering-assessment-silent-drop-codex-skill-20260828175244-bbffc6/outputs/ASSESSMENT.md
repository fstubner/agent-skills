# Engineering Assessment

## Scope and context

**Depth:** targeted.

**In scope:** the complete application and repository metadata that could affect
the CSV import path: `cmd/importer/main.go`, `internal/store/store.go`,
`README.md`, `docs/runbook.md`, and `go.mod`.

**Out of scope:** production deployment configuration, partner CSV samples,
database infrastructure, and runtime/operational telemetry; none is present in
this repository.

This is a Go 1.22 command-line CSV importer. It reads a partner file, validates
a small subset of fields, writes subscribers to an in-memory store, and prints
a row count.

## What I ran

The repository declares Go module metadata but no explicit build, test, or lint
scripts. I attempted the applicable Go checks before recording findings:

```text
$ go test ./...
/bin/bash: line 1: go: command not found

$ go build ./...
/bin/bash: line 1: go: command not found

$ go vet ./...
/bin/bash: line 1: go: command not found
```

No project tests, build, vet, lint, or audit checks could be executed because
the Go toolchain is unavailable in the environment.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Data integrity | Valid rows with the same email silently overwrite one another, while the success count reports every accepted row. This can explain a successful import whose resulting subscriber count is lower than the reported count. | `internal/store/store.go:12,18` uses email as the sole map key and overwrites the prior subscriber; `cmd/importer/main.go:20-24` increments `imported` for each row and prints it as the imported total. | Define duplicate-email semantics explicitly. Detect duplicates before saving, report them separately, and make the confirmation count reflect unique persisted subscribers (or clearly report accepted rows versus upserts). Add a fixture with repeated emails. |
| 2 | High | Reliability | File-open and CSV-read failures are discarded, so an unreadable or malformed import can still reach the confirmation path and be presented as a successful result. | `cmd/importer/main.go:12-13` assigns both `os.Open` and `ReadAll` errors to `_`; `main.go:24` always prints a confirmation after the loop. | Check and return errors from `os.Open` and `ReadAll`; close the file; emit a non-success exit status and no partner confirmation when parsing fails. |
| 3 | High | Data integrity | Subscriber data is process-local and disappears when the command exits, so the tool cannot provide durable import results and rerunning it does not operate on the prior dataset. | `internal/store/store.go:10-13` initializes a package-global in-memory map, and `Save` (`store.go:15-19`) writes only to that map. `README.md` and `docs/runbook.md` describe imports but provide no persistence or recovery mechanism. | Persist subscribers in an identified durable datastore or file with an atomic commit, and define the import transaction/recovery behavior. Verify the confirmation count against the committed result. |
| 4 | Medium | Correctness | Validation is incomplete and positional assumptions are unchecked: a row with an empty plan is accepted, and the first row is unconditionally discarded as a header. A headerless file loses its first subscriber, while malformed schema can be reported as success. | `cmd/importer/main.go:16-20` skips `rows[0]` regardless of content, checks only `len(row) < 3` and `row[1] == ""`, and saves `row[2]` without validating it. | Validate the header/schema explicitly, validate email and required plan values, reject or report malformed rows with reasons, and include skipped/error counts in the confirmation. |
| 5 | Medium | Reliability | `Count` reads the shared map without locking, unlike `Save`. Concurrent callers can race with writes and may trigger a concurrent-map read/write failure. | `internal/store/store.go:15-19` locks `Save`, but `store.go:21` returns `len(items)` without acquiring `mu`. | Protect `Count` with the same mutex (or use a read/write mutex) and add a concurrent access test. |

## Strengths

- `store.Save` serializes map writes with a mutex (`internal/store/store.go:15-19`), which is a sound baseline for shared mutable state.
- The importer isolates row acceptance from the loop (`cmd/importer/main.go:16-21`), matching the documented intent in `README.md` that one invalid row should not fail the whole import.
- The module declares its Go version and module path in `go.mod`, providing a minimal reproducible dependency boundary; there are no external dependencies listed.

## Key Risks

Findings 1 and 3 directly undermine the partner-facing subscriber count and the runbook's expectation that imports are safe to repeat. Finding 2 makes the reported success status untrustworthy on ordinary file or parse failures. Finding 4 can silently omit or accept incorrect records, compounding count discrepancies.

## Priority Order

1. Make import failure states explicit by handling file and CSV errors (Finding 2).
2. Establish durable, atomic persistence and measure the committed result (Finding 3).
3. Resolve duplicate-email behavior and separate accepted, skipped, and persisted counts (Finding 1).
4. Add schema and field validation with actionable row-level reporting (Finding 4).
5. Lock `Count` and add concurrency coverage (Finding 5).

## Coverage Gaps

- No production datastore, deployment configuration, CI configuration, or operational metrics exists in the inspected repository, so persistence expectations and production concurrency cannot be verified beyond the code shown.
- No partner CSV samples or integration fixtures were available; header, delimiter, encoding, duplicate, and malformed-row behavior was assessed from the implementation only.
- `go test ./...`, `go build ./...`, and `go vet ./...` were attempted but could not run because `go` is not installed. No runtime, load, penetration, or end-to-end testing was performed.
- Dependency vulnerability auditing was not attempted because there are no declared third-party dependencies and the Go toolchain is unavailable.
- Evaluation cases, graders, expected answers, and sibling run outputs were not searched for or inspected.
