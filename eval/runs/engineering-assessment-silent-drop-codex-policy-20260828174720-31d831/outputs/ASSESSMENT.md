# Import assessment

Scope: reviewed the importer entry point, store, README, and runbook. The findings below are limited to the five issues most likely to explain missing subscribers or create misleading confirmation.

1. **Critical — imported subscribers are not persisted beyond the process.** `internal/store/store.go:10-13` keeps all subscribers in a package-global map, and `cmd/importer/main.go:20` only writes to that map. The CLI exits immediately after printing its confirmation, so a later process (or the product that serves subscribers) starts with an empty map. A run can therefore report success while every imported subscriber is unavailable afterward. Replace the process-local map with the repository’s durable subscriber store (or add one), and make the confirmation mean the durable write completed.

2. **High — input and CSV errors are discarded, allowing false-success or partial imports.** `cmd/importer/main.go:12-13` ignores both `os.Open` and `ReadAll` errors. A missing/unreadable file can fail unpredictably, while a malformed CSV may return records that are processed and then produce a normal-looking count. The partner can be told an import succeeded even though the source was not fully read. Check the open/read errors, close the file, and fail the run (with a non-zero exit) when the complete input cannot be read.

3. **High — the reported count is not the number of subscribers actually stored.** The importer increments `imported` for every accepted row (`cmd/importer/main.go:20-21`), but the store keys by email and overwrites duplicates (`internal/store/store.go:18`). Thus duplicate rows inflate the success message, and a rerun can claim rows imported without increasing the subscriber set. Count durable insert/update outcomes or report both processed rows and created/updated subscribers, with duplicate behavior defined.

4. **High — validation is too weak and silently drops likely-valid-looking records.** The only checks are a minimum of three columns and a non-empty, untrimmed value in column 2 (`cmd/importer/main.go:16-18`). There is no header/schema verification, email validation, plan validation, or normalization. Rows with missing/invalid fields are silently skipped while the command still prints success, which can directly manifest as missing subscribers. Validate the expected schema at the trust boundary, normalize fields, collect rejected-row reasons, and expose rejected counts/details in the result.

5. **Medium — `Count` can race with writes and can report inconsistent state.** `Save` locks the map (`internal/store/store.go:15-19`), but `Count` reads it without locking (`internal/store/store.go:21`). Concurrent imports or readers can trigger a Go data race or runtime `concurrent map read and map write` failure. Protect reads with the same mutex (or use a concurrency-safe store), and add a focused concurrent test.

## Verification

The review was performed from the repository source and documentation. `go test ./...`, `go vet ./...`, and `go build ./...` were attempted, but could not run because `go` is not installed in the environment. No application files were changed.
