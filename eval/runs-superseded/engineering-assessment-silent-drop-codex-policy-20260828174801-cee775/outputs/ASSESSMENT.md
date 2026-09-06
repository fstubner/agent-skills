# Importer assessment

The reported success is not a reliable indication that subscribers were retained. The five highest-value findings are below, ordered by likely business impact.

## 1. Subscriber data is not persisted beyond the process

**Severity: Critical** — `internal/store/store.go:14-27` stores records only in the package-global `items` map. There is no file, database, or remote write, and the CLI exits immediately after printing its count. A successful command therefore loses every subscriber when the process ends; a later process starts with an empty map. This directly explains “success” followed by missing subscribers.

**Recommendation:** Introduce a durable store and make the import completion signal depend on a committed transaction (or an explicitly durable batch write). Define the behavior for restart/retry before rollout.

## 2. The reported count measures loop iterations, not saved subscribers

**Severity: High** — `cmd/importer/main.go:19-22` calls `store.Save(...)` and unconditionally increments `imported`; `Save` returns no error or result. Duplicate email addresses overwrite the prior map entry (`items[s.Email] = s`), but each duplicate is counted as imported. Consequently, the confirmation can overstate the number of subscribers retained, while the in-memory store’s `Count` can be lower.

**Recommendation:** Return and handle persistence errors, define duplicate semantics, and report distinct successfully committed inserts/updates plus skipped rows. Include duplicate and failure counts in the partner-facing result.

## 3. Input and file errors are silently ignored

**Severity: High** — `main.go:14-15` discards both `os.Open` and `ReadAll` errors. A missing/unreadable file can lead to a nil file dereference or an empty/partial result being treated as an import, and malformed CSV parsing can be hidden rather than reported. `os.Args[1]` is also accessed without checking that an argument exists (`main.go:13`).

**Recommendation:** Validate CLI arguments, check open/read/parse errors, close the file, and return a nonzero exit status without reporting success unless the complete input was processed according to the chosen partial-failure policy.

## 4. Validation is materially weaker than the stated CSV contract

**Severity: High** — the importer accepts any non-empty `row[1]` and any `row[2]` (`main.go:18-20`). It does not validate email syntax, normalize whitespace/case, require a supported plan, or validate the header/column meaning. Rows with extra columns are accepted, and short rows are skipped without a reason. This can silently omit valid-looking partner data or save unusable subscriber records.

**Recommendation:** Validate the header and each required field at the trust boundary, normalize according to an explicit contract, and capture row-level rejection reasons and line numbers in the result.

## 5. The store has an unsafe read path under concurrency

**Severity: Medium** — writes lock `items` in `Save`, but `Count` reads `items` without acquiring `mu` (`internal/store/store.go:23-27`). If count or other readers are added while an import is running, concurrent map access can race or panic. There are no tests covering this behavior or the import failure paths.

**Recommendation:** Protect all map access consistently (or use a concurrency-safe store) and add focused tests for concurrent access, duplicates, malformed input, I/O failures, and the success-count contract.

## Verification and uncertainty

Static inspection covered `cmd/importer/main.go`, `internal/store/store.go`, `README.md`, `docs/runbook.md`, and `go.mod`. The repository contains no test files. `go test ./...`, `go vet ./...`, `go build ./...`, and a runtime smoke test could not be executed because the Go toolchain is not installed in the environment. The persistence finding is certain from the code shown; the exact partner-visible symptom depends on whether another process reads this package’s in-memory state, which is not present in this repository.
