# Import assessment

The importer can print a successful confirmation while losing or misrepresenting subscribers. The five highest-value findings are:

1. **Critical — subscriber state is process-local and never persisted.** `internal/store/store.go:10-18` stores records only in a package-global map. `cmd/importer/main.go` exits immediately after printing, and there is no database or file write. A successful run therefore does not make subscribers available to a later process (and a rerun starts with an empty store), contradicting the runbook's expectation that imports are safe to repeat (`docs/runbook.md:3-5`). This is the most direct explanation for subscribers missing after a reported-success import.

2. **High — the reported count is rows accepted, not subscribers actually stored.** The CLI increments `imported` for every row (`cmd/importer/main.go:20-21`), while `Save` keys records by email and overwrites an earlier record on duplicate email (`internal/store/store.go:18`). Duplicate rows can therefore produce a large success count while yielding fewer unique subscribers; the confirmation also cannot distinguish an update from a new subscriber.

3. **High — malformed input and file failures are silently treated as a successful/empty import.** Both `os.Open` and `ReadAll` errors are discarded (`cmd/importer/main.go:12-13`). A missing or unreadable path can consequently lead to a nil-file read/panic or an incomplete/empty result without an actionable error, and there is no non-zero failure reporting. Operators can forward a misleading confirmation instead of discovering that the import was not processed.

4. **High — validation does not enforce the stated subscriber record contract.** The only checks are “at least three columns” and a non-empty email (`cmd/importer/main.go:17-18`). The plan is allowed to be empty, email syntax is not validated, whitespace is not normalized, and extra columns are silently accepted. Invalid or mismatched partner rows can be saved under unusable keys, while rows with shifted columns may be interpreted as valid subscribers.

5. **Medium — the header and CSV shape are not validated before data is imported.** The implementation unconditionally skips `rows[0]` (`cmd/importer/main.go:16`) and assumes the remaining records are in the expected column order. An empty file, header-only file, wrong header, or reordered columns can result in a zero-count “success” or corrupted records; there is no check that the file was actually the expected partner export.

## Verification

Reviewed all repository source, documentation, and module files. There are no repository tests, and `go test ./...` / `go vet ./...` could not run because the environment does not have the Go toolchain installed. No application files were changed.
