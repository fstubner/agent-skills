# Import assessment

The reported success is not evidence that subscribers were durably imported. The five highest-value findings are:

1. **The reported count is not the number of subscribers stored (critical).** `main.go:20-24` increments `imported` for every accepted row, but `store.Save` overwrites `items[s.Email]` (`store.go:15-18`). Duplicate email rows therefore inflate the success count while producing only one stored subscriber. A repeated import can also report success without proving any new records were added.

2. **Imported data is process-local and non-persistent (critical).** The repository stores subscribers only in the package-global in-memory map (`store.go:10-13`). When the importer process exits, the map disappears. Unless another persistence layer exists outside this repository, a partner can receive a successful message while no subscribers remain available to the application afterward.

3. **Input and CSV errors are discarded, and the program still reports success (high).** `os.Open` and `ReadAll` errors are ignored (`main.go:12-13`). A missing/unreadable file can lead to a nil-file panic or an empty/partial result, and malformed CSV data is not surfaced. There is no non-zero exit status or error message for these failures.

4. **Validation is materially incomplete (high).** The only row checks are at least three columns and a non-empty second column (`main.go:16-19`). The importer accepts blank plans, invalid email strings, arbitrary headers, and extra/misaligned columns; it also unconditionally drops the first row. Bad rows can thus be silently skipped or incorrect subscriber records can be saved, with no rejection details.

5. **The confirmation omits the reason rows were not imported (medium/high).** The output reports only `imported` versus `len(rows)-1` (`main.go:24`), while all invalid rows are silently skipped (`main.go:17-18`). Operators and partners cannot distinguish validation rejects, malformed-file behavior, duplicate overwrites, or a genuinely empty input, making a misleading “success” difficult to diagnose.

## Verification

I inspected the importer, store, README, and runbook. The source builds were not executable in this workspace because the `go` toolchain is unavailable; no application files were changed.
