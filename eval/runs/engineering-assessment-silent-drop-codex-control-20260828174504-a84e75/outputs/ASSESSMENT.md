# Import assessment

The reported success is not evidence that subscribers were retained. The importer can print a successful count even when rows are lost, overwritten, or never made durable.

## Five highest-value findings

1. **Subscriber data is process-local and is lost on exit (Critical).** `internal/store/store.go` stores records only in the package-global `items` map. There is no database, file, or other durable sink, and the CLI exits immediately after printing. A successful import therefore leaves no subscribers available to the next process or to a partner-facing system. This directly explains “success, then missing subscribers.”

2. **The confirmation count is not the number of subscribers saved (High).** `cmd/importer/main.go` increments `imported` for every row passed to `store.Save`. Since `Save` assigns by email (`items[s.Email] = s`), duplicate email rows overwrite one another while all are counted as imported. The printed count can therefore overstate the number of distinct retained subscribers; there is also no verification that the final store count matches the confirmation.

3. **CSV/file errors are silently ignored (High).** `os.Open` errors and `ReadAll` errors are discarded. A missing/unreadable file can cause a nil-file panic, while malformed or partially read CSV input can be processed and reported as a successful partial import. The partner receives no indication that the source was not fully consumed.

4. **Validation is too weak to reliably identify importable subscribers (High).** The importer accepts any non-empty `row[1]` as an email and any value, including an empty value, as the plan. It does not validate email syntax, normalize casing/whitespace, reject malformed rows with extra/invalid fields, or report skipped-row reasons. Invalid identifiers can become map keys, and formatting variants can create duplicate logical subscribers.

5. **Input shape is assumed rather than checked (Medium).** The first CSV row is unconditionally treated as a header, and every remaining row is indexed positionally. A headerless file loses its first subscriber; a wrong-column or shifted export can be skipped or saved with incorrect fields without failing the import. The success line reports only `imported` versus total data rows, not rejected rows, parse errors, or durable-write status.

## Verification

Reviewed `README.md`, `docs/runbook.md`, `cmd/importer/main.go`, `internal/store/store.go`, and `go.mod`. The application source was not changed. `go test ./...` and `go vet ./...` could not be run because the workspace environment does not have the `go` executable installed.
