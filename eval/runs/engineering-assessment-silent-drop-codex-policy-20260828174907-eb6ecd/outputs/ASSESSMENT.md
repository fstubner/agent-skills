# Importer assessment

The reported success line is not evidence that subscribers were durably imported. The five highest-value findings are:

1. **Critical — subscriber data disappears when the process exits.** `internal/store/store.go:10-19` keeps all subscribers in a package-level in-memory map; there is no database, file, or external persistence. A successful command therefore loses every imported subscriber at process termination, which directly explains “success” followed by missing subscribers. Replace this with durable storage and verify the committed result before reporting success.

2. **High — file and CSV failures are silently reported as success.** `cmd/importer/main.go:12-13` ignores both `os.Open` and `ReadAll` errors. A missing/unreadable file, malformed CSV, or partial read can produce an empty/partial import and still print a success-looking count. Check arguments and all I/O/parser errors, close the file, and return a non-zero status with an unambiguous failure message.

3. **High — the confirmation count is not the number of subscribers stored.** `cmd/importer/main.go:20-24` increments once per accepted row, while `Save` overwrites by email at `internal/store/store.go:18`. Duplicate email rows can make “imported N” exceed the resulting subscriber count; rerunning the same file also reports all rows as imported. Report inserted/updated/skipped counts based on the durable store, and define duplicate handling explicitly.

4. **High — validation is insufficient at the import boundary.** The only checks are row length and a non-empty email (`cmd/importer/main.go:17`); empty plans, malformed emails, whitespace/case variants, and arbitrary extra/misordered columns are accepted. Invalid records can overwrite valid records because email is the map key. Validate the header/schema, normalize identifiers, validate required fields and email format, and retain row-level rejection reasons.

5. **Medium — there is no import integrity or authorization/operational audit trail.** The command accepts any path from `os.Args[1]`, has no authenticated partner/source context, no import ID or transaction boundary, and emits only aggregate stdout (`cmd/importer/main.go:11-24`). Operators cannot prove which file was processed, distinguish a complete run from a partial one, or reconcile the result. Add authorized source handling, an import record with file identity/checksum and status, atomic or resumable commit semantics, and structured per-import audit metrics.

## Verification and uncertainty

Static inspection covered all application and runbook files in the workspace. `go test ./...`, `go vet ./...`, and `go build ./...` could not be run because the environment has no `go` executable. There are no repository tests to exercise persistence, duplicate handling, malformed input, or failure reporting. The assessment assumes the shown in-memory store is the production path; if another persistence layer exists outside this repository, finding 1 should be re-scoped.
