# Import assessment

The importer can print a successful result while subscribers are absent or the
input was not fully processed. Findings are ordered by likely customer impact.

1. **Subscriber data is only held in process memory (critical).**
   `internal/store/store.go:10-13` initializes a package-global map, and
   `cmd/importer/main.go:20` writes only to that map. The process exits
   immediately after printing its count, so every successful import is lost on
   restart and is not visible to any other process. This directly explains
   subscribers missing after an import. Persist the records in the system of
   record and make the import confirmation depend on durable writes.

2. **Input and CSV read errors are discarded, producing false success (high).**
   `cmd/importer/main.go:12-13` ignores both `os.Open` and `ReadAll` errors.
   An unreadable/missing file can therefore be reported as a zero-row import,
   while a read failure after some rows can be reported as a partial success
   with no explicit failure status. The missing argument can also panic at
   `os.Args[1]`. Check arguments and all I/O errors, return a non-zero exit
   status, and identify whether the result is complete or partial.

3. **The reported imported-row count is not the number of subscribers saved
   (high).** `main.go:20-21` increments `imported` for every accepted row, but
   `store.go:18` keys records by email and overwrites an existing value.
   Duplicate emails in one file (or a repeat import with changed plan) can
   therefore yield `imported N` while fewer than N subscriber records exist,
   and the output does not say which records were replaced. Define duplicate
   semantics explicitly and report inserted, updated, skipped, and failed
   counts from the persistence layer.

4. **There is no schema/header validation, so malformed files can be accepted
   as valid imports (high).** `main.go:16-18` blindly discards the first row and
   treats any later row with three columns as a subscriber; it never verifies
   the expected header, column order, extra columns, or a consistent record
   shape. A shifted export can put an ID or another field in the email key,
   making the intended subscribers appear missing while the tool reports
   success. Validate the header and schema before writing, and reject the file
   when the format is incompatible.

5. **Validation is too weak at the trust boundary (medium/high).** The only
   checks are `len(row) < 3` and exact `row[1] == ""` (`main.go:17`). Invalid
   email strings, whitespace-only values, untrimmed addresses, and empty plans
   are accepted; logically identical addresses with different case or spaces
   become different map keys. This can create unusable or apparently missing
   subscribers. Normalize according to the product’s identity rules and
   validate required fields before saving, with focused tests for malformed,
   whitespace, and duplicate inputs.

## Verification and remaining uncertainty

I inspected the importer, store, README, and runbook. No automated tests are
present in the repository. `go test ./...` and `go build` could not be run
because the Go executable is not installed in the environment. Runtime data
durability and downstream visibility should be confirmed against the intended
production system of record, which is not present in this repository.
