# Engineering Assessment

## Scope and context

Depth: targeted. I enumerated and read the complete application and documentation surface: `README.md`, `go.mod`, `docs/runbook.md`, `cmd/importer/main.go`, and `internal/store/store.go`. This is a Go 1.22 command-line CSV subscriber importer whose apparent platform target is the operator's local process.

## What I ran

The repository declares no build, test, lint, or audit scripts. I attempted the applicable Go checks before forming findings:

```text
go test ./...
/bin/bash: line 1: go: command not found

go build ./...
/bin/bash: line 1: go: command not found

go vet ./...
/bin/bash: line 1: go: command not found
```

No automated checks could start because the Go toolchain is unavailable.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Data integrity | Imported subscribers are not persisted beyond the importer process, so a reported-success import can leave no subscribers available to later executions or processes. | `internal/store/store.go:10-18` defines the entire store as the process-global map `items`; `Save` only assigns to that map and performs no file/database write. `cmd/importer/main.go:24` prints success and exits without exporting state. | Replace the process-local map with a durable store, define the commit boundary, and make the confirmation report only after durable writes succeed. Add a fresh-process integration test proving imported rows remain available. |
| 2 | High | Reliability | File-open and CSV-read failures are ignored, allowing the command to continue with a nil/empty result and print a misleading success count. | `cmd/importer/main.go:12-13` assigns `_` for both `os.Open` and `ReadAll` errors; `main.go:24` always prints `imported ...` and does not return a failure status. | Validate the argument and check both errors; close the file; print a diagnostic to stderr and exit nonzero on failure. Do not emit partner confirmation unless parsing and persistence completed. |
| 3 | High | Correctness | A missing input path causes an unrecoverable panic instead of a usable operator error. | `cmd/importer/main.go:12` indexes `os.Args[1]` without checking `len(os.Args)`. Running the binary without a filename therefore panics before any controlled reporting. | Require exactly one path argument, print usage, and return a nonzero exit code for missing or extra arguments. |
| 4 | High | Data integrity | The confirmation count is not a count of successfully saved subscribers: every row passing only the local shape/email checks increments `imported`, and `Save` has no error result. | `cmd/importer/main.go:16-21` increments `imported` immediately after `store.Save`; `internal/store/store.go:15-19` cannot report write failure or distinguish a new subscriber from an overwrite. The README promises a row count (`README.md:4-5`). | Make persistence return an error/result, count committed records explicitly, and report rejected, inserted, updated, and failed rows separately. Define duplicate-email behavior and test it. |
| 5 | Medium | Validation | Rows with an empty plan are accepted, and validation is based only on `len(row) < 3` and a nonempty email field. Malformed or semantically incomplete subscribers can therefore be stored and counted as imported. | `cmd/importer/main.go:16-20` checks neither `row[2]` nor email format/normalization; `Subscriber` in `internal/store/store.go:5-8` has no validation. | Introduce a single row-validation function with required-field, email-format, normalization, and plan-value rules; record rejection reasons and cover malformed CSV rows with tests. |

## Unconfirmed / Requires Investigation

- Whether another process reads `store.items` through code not present in this repository, or whether production wraps this binary with an external persistence mechanism, could not be established from the available files. The checked-in implementation itself has no durable persistence.
- The partner's exact CSV and the production execution environment were unavailable, so the specific last-import row failures and whether the source contained a header, duplicate emails, or malformed records could not be reproduced.

## Strengths

- `internal/store/store.go:15-19` protects map writes with a mutex and uses email as a stable key, giving deterministic overwrite behavior within one process.
- `cmd/importer/main.go:16-18` skips short/empty-email rows rather than allowing one visibly invalid row to abort the loop, matching the stated best-effort import goal in `README.md:4`.

## Key Risks

Finding 1 is the most direct explanation for subscribers disappearing after a successful confirmation. Findings 2-4 can turn operational or persistence failures into inaccurate partner-facing success messages; finding 5 compounds this by accepting incomplete records.

## Priority Order

1. Introduce durable persistence and a durable-write success boundary (Finding 1).
2. Stop ignoring open/read/write outcomes and make failure status observable (Findings 2 and 4).
3. Add argument validation to prevent operator panics (Finding 3).
4. Formalize and test subscriber-field validation (Finding 5).

## Coverage Gaps

- No database, migrations, deployment configuration, CI configuration, tests, or production adapters were present in the enumerated repository and therefore none could be assessed.
- `go test`, `go build`, and `go vet` were attempted but unavailable because `go` is not installed; their test/build/static-analysis results are consequently unknown.
- No load, concurrency, crash-recovery, end-to-end, penetration, or production-data testing was performed.
- Production persistence, process lifecycle, invocation wrapper, partner CSV samples, logs, and runtime metrics were unavailable.
