# Import assessment

The reported success is not evidence that subscribers were retained. The five highest-value findings are:

1. **Critical — imports are not persisted.** `internal/store/store.go:10-18` stores subscribers only in the process-global `items` map. The CLI exits immediately after printing its result (`cmd/importer/main.go:24`), so every successful run loses all imported subscribers. This directly explains a partner seeing missing subscribers after a reported success.

2. **High — file and CSV errors are discarded.** `cmd/importer/main.go:12-13` ignores both `os.Open` and `ReadAll` errors. A missing/unreadable file can therefore lead to a nil-file panic or misleading processing, and malformed/truncated CSV input can still produce a success message based on partial data. The operator has no reliable indication that the source was fully read.

3. **High — the command assumes valid invocation and a header.** `cmd/importer/main.go:12` indexes `os.Args[1]` without checking arguments, and `main.go:16` always drops the first record. Missing arguments can panic; a headerless partner file silently loses its first subscriber. There is no header validation to detect this mismatch.

4. **High — validation is too weak for subscriber identity and plan data.** The only checks at `cmd/importer/main.go:17-18` are row width and a non-empty email field. Whitespace-only or malformed emails, and empty/invalid plans, are accepted. These records can be saved under unusable keys or with incomplete subscriber state while being counted as imported.

5. **Medium — the reported count measures accepted rows, not subscribers retained.** `cmd/importer/main.go:20-24` increments `imported` for every row passed to `Save`, while `Save` overwrites by email at `internal/store/store.go:18`. Duplicate emails therefore inflate the reported count, and the message does not report rejected rows, replacements, or the final unique subscriber total. Partners can receive “success” even when the effective result differs materially from the stated count.

## Verification

Static inspection covered the CLI, store, README, and runbook. The repository contains no tests. `go test ./...` and `go vet ./...` could not be executed because the environment does not have the `go` command installed.
