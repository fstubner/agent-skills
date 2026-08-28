# Engineering Assessment

## Scope and approach

Depth: **targeted**. I enumerated and read every repository file in scope:

`README.md`, `go.mod`, `cmd/importer/main.go`, `internal/store/store.go`, and
`docs/runbook.md`.

In scope were the Go CLI, storage layer, import/reporting behavior, input
validation, and operator documentation. The `.agent-input` workflow material
was used only for assessment instructions; evaluation cases, graders, expected
answers, and sibling outputs were not searched for or inspected.

## What I ran

The repository declares Go 1.22 in `go.mod`, but no build/test/lint scripts or
CI configuration are present. I attempted the applicable project checks before
writing findings:

```text
go test ./...  -> /bin/bash: line 1: go: command not found
go vet ./...   -> /bin/bash: line 1: go: command not found
go build ./... -> /bin/bash: line 1: go: command not found
gofmt -d .    -> /bin/bash: line 1: gofmt: command not found
```

No checks ran successfully. `npm`, Cargo, .NET, migration, backend, and
frontend checks were not attempted because this is a Go-only repository and
the corresponding project areas/configuration are absent.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Data integrity | Imported subscribers are not persisted beyond the importer process. | `internal/store/store.go:10-18` defines `items` as an in-memory package variable and `Save` only assigns to that map; `cmd/importer/main.go:20` calls it, then `main` exits. No database, file, or remote persistence exists in the enumerated files. | Implement a durable repository and make the import commit its records transactionally. Add a restart/read-after-import test proving subscribers remain available after the CLI exits. |
| 2 | High | Reliability | File-open and CSV-read failures are discarded, so an unreadable or malformed import can still report success. | `cmd/importer/main.go:12-13` assigns both returned errors from `os.Open` and `ReadAll` to `_`; `main.go:24` always prints an imported-row report afterward. A nil file can also cause the subsequent read to panic. | Check and report `os.Open` and `ReadAll` errors, close the file, return a nonzero exit status, and ensure no success confirmation is emitted for a failed read. |
| 3 | High | Correctness | Duplicate email rows overwrite earlier subscribers while the report counts every row as imported. | `internal/store/store.go:18` keys the map by `s.Email`, replacing an existing value; `cmd/importer/main.go:20-21` increments `imported` for every accepted row. Thus `imported` can exceed the number of stored subscribers, while the partner receives the inflated count at line 24. | Define duplicate semantics explicitly: reject/report duplicates or count successful upserts separately from new subscribers, and include duplicate/error counts in the confirmation. |
| 4 | High | Correctness | The importer silently skips invalid rows but reports only a generic total, making a successful-looking import unable to explain missing subscribers. | `cmd/importer/main.go:16-19` skips rows with fewer than three fields or an empty email; `main.go:24` reports only `imported` and `len(rows)-1`, with no skipped-row details, line numbers, or error output. This matches the README’s skip policy (`README.md:3-4`) but gives operators no actionable rejection information. | Track and report skipped counts plus row numbers/reasons, write a durable rejection report, and make the operator confirmation distinguish accepted, rejected, and duplicate rows. |
| 5 | Medium | Concurrency / correctness | `Count` is not synchronized with `Save`, creating a data race if used concurrently and making the storage API unsafe for future reporting or readers. | `internal/store/store.go:15-19` locks writes, but `Count` at line 21 reads `items` without locking. Go maps cannot safely be read concurrently with writes. | Protect `Count` with the same mutex (or an `RWMutex`) and add a concurrent access test under the race detector once Go tooling is available. |

## Strengths

- The import loop isolates row-level validation from the whole file: a short
  row or blank email is skipped rather than immediately aborting the process
  (`cmd/importer/main.go:16-19`), consistent with the stated partner behavior
  (`README.md:3-4`).
- `Save` serializes map writes with a mutex (`internal/store/store.go:15-18`),
  which is a sound starting point for concurrent writes even though the read
  path is incomplete.

## Key risks

Finding 1 is the primary incident risk: the apparent import success does not
create durable subscriber state. Findings 2–4 can independently produce
misleading confirmations or unexplained omissions, so operators cannot safely
distinguish persistence failure from rejected, malformed, or duplicate input.

## Priority order

1. Replace the process-local map with durable, transactional persistence and
   verify data survives process restart (Finding 1).
2. Handle open/read errors with nonzero exit status and no success message
   (Finding 2).
3. Make duplicate and rejected-row accounting explicit in the confirmation
   and operator workflow (Findings 3–4).
4. Synchronize `Count` and add race/concurrency coverage (Finding 5).

## Unconfirmed / requires investigation

- Whether the partner’s missing subscribers were caused by process exit,
  duplicate emails, invalid rows, or an external downstream system cannot be
  confirmed from this repository; there are no production logs, input CSV,
  deployment configuration, or downstream integration present.
- Whether the lack of persistence is intentional because an omitted external
  service exists outside this checkout is unknown. The repository itself shows
  no such integration.

## Coverage gaps

- No automated tests, benchmarks, CI configuration, database migrations, or
  deployment manifests were present in the enumerated repository.
- Go checks could not run because `go` and `gofmt` are unavailable; therefore
  compilation, runtime behavior, and race-detector results were not verified.
- No production execution, persistence backend, partner CSV, metrics, logs,
  network/downstream service, load test, penetration test, or recovery/backup
  process was examined.
