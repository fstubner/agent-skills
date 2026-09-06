# Importer assessment

## 1. Critical — imported subscribers are not durable

`internal/store/store.go:10-13` keeps all subscribers in a package-level map, and
`cmd/importer/main.go:20` writes only to that map. The map disappears when the
importer process exits, so a later process (or a restart/deploy) has no records
from the prior import. The printed success line therefore does not mean the
subscribers were persisted anywhere. This is the most direct explanation for
subscribers being missing after a successful run.

## 2. High — input/open/read failures are discarded and can be reported as success

`cmd/importer/main.go:12-13` ignores both `os.Open` and `ReadAll` errors. A
missing/unreadable file can lead to a nil-file panic during CSV reading, while a
CSV parse/read failure can leave partial or empty data and still reach the
success output. There is also no argument-count check, so invoking the binary
without a path panics at `os.Args[1]`. Trust-boundary failures need explicit
errors and a non-zero exit instead of a confirmation message.

## 3. High — skipped invalid rows are silently treated as a successful import

Rows with fewer than three columns or an empty email are silently skipped at
`cmd/importer/main.go:16-19`; there is no email or plan validation. The command
then prints `imported X of Y`, and the runbook tells the operator to forward that
line as confirmation (`docs/runbook.md:3-5`). Partners can therefore receive a
successful-looking result while subscribers were omitted, with no row numbers
or reason codes to reconcile. The reported count is an attempted-save count,
not a durable-success count.

## 4. High — duplicate emails inflate the reported count and overwrite data

`store.Save` uses email as the map key (`internal/store/store.go:15-19`), so a
duplicate email overwrites the earlier subscriber. The importer increments
`imported` for every accepted row (`cmd/importer/main.go:20-21`), meaning the
confirmation can say all rows imported even though fewer distinct subscribers
exist, and a later duplicate silently changes the plan. Duplicate policy and
the distinction between rows and resulting records must be explicit.

## 5. Medium — `Count` has an unsynchronized map read

`internal/store/store.go:21` reads `items` without acquiring `mu`, while
`Save` writes under that mutex. If count reporting or another caller uses
`Count` concurrently with an import, this is a data race and can panic with a
concurrent map read/write. The current command does not call `Count`, but the
store API is unsafe for concurrent use and offers no transaction or committed
result boundary.

## Verification

- Inspected all repository files: `README.md`, `docs/runbook.md`,
  `cmd/importer/main.go`, `internal/store/store.go`, and `go.mod`.
- Confirmed there are no repository test files.
- Attempted `go test ./...` and `go build ./...`; both could not run because
  the environment does not have the `go` executable installed.
- No application files were changed.

Remaining uncertainty: because Go is unavailable and the store has no external
backend, runtime behavior beyond the code paths above could not be exercised.
