# Importer assessment

The five highest-value findings are below, ordered by likely impact on missing subscribers and by risk of a false success report.

1. **Imported subscribers are not persisted** — `internal/store/store.go` keeps all records in a package-global map, and there is no file or database backend. The CLI exits after printing its count, so a subsequent process (or restart) has an empty store even though the prior command reported success. This is the most direct explanation for subscribers disappearing after an import. Persist the import transactionally and verify the committed record count before reporting success.

2. **Input and CSV errors are discarded, so failures exit successfully** — `cmd/importer/main.go` ignores the errors from `os.Open` and `ReadAll`. A missing/unreadable file can lead to a nil-file failure, while malformed CSV input may produce partial rows and an error that is never surfaced. The command has no explicit non-zero failure path and can therefore print a success-style result for incomplete data. Check and report both errors, and make the process exit non-zero unless the complete input was processed.

3. **The first physical row is always dropped as a header** — the loop starts at `rows[1:]` without detecting or validating a header. A partner file without a header loses its first subscriber silently; a differently formatted header also gets treated as data only if it happens to be after the first row. Detect the expected header (including BOM/whitespace handling) or require and validate the format before importing.

4. **Skipped rows are presented as a successful import without a rejection report** — rows with fewer than three fields or an empty email are silently continued, while the output only says `imported X of Y rows`. There is no rejected-row count, line number, reason, or threshold that turns excessive rejection into failure. A partner can receive “success” while valid-looking records were omitted. Validate all required fields, collect actionable rejection details, and fail or prominently warn when any records are rejected.

5. **Duplicate email rows overwrite earlier subscribers while the count reports both** — `Save` uses email as the map key, so later rows replace earlier rows. The CLI increments `imported` for every accepted row, not for newly stored subscribers, and does not report duplicates. The displayed count can therefore exceed the actual subscriber count and a duplicate may erase an earlier plan or other data. Define duplicate semantics, detect/report duplicates, and reconcile accepted rows against the number of committed unique records.

## Verification

I inspected the complete repository contents relevant to the importer (`cmd/importer/main.go`, `internal/store/store.go`, `README.md`, `docs/runbook.md`, and `go.mod`). The Go toolchain is unavailable in this environment, so `go test ./...` and `go vet ./...` could not run; no application files were changed.
