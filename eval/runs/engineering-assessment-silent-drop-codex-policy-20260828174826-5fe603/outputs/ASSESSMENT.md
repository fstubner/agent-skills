# Repository assessment

The importer can print a successful-looking confirmation while subscribers are
missing. The five highest-value findings are below, ordered by priority.

## 1. Subscriber data is not durable

`internal/store/store.go:10-13` keeps all subscribers in a package-global map,
and there is no database, file, or other persistence layer. The map is empty
again whenever the importer process exits; the CLI therefore cannot provide
the repeat-safe behavior promised by `docs/runbook.md:3-5`, nor can a later
process observe the imported subscribers. This is the strongest explanation
for subscribers disappearing after a reported-successful run.

**Recommendation:** persist imports in the system of record (with an
idempotent key/upsert), and make the confirmation reflect the committed result.

## 2. File-open and CSV-read failures are ignored

`cmd/importer/main.go:12-13` discards both `os.Open` and `ReadAll` errors. A
missing/unreadable file can panic when the nil file is passed to the reader;
truncated or malformed input can produce partial/empty rows while the program
still proceeds to print `imported ...` and exits without an explicit import
failure. This makes the partner-facing success signal unreliable and can
explain a zero or partial import that was called successful.

**Recommendation:** validate the argument, check `Open`, close the file, check
CSV errors, and return a non-zero exit status without reporting success unless
the complete accepted result is committed.

## 3. The reported count is accepted rows, not subscribers actually present

`main.go:15-24` increments `imported` for every row that passes the minimal
check. `store.Save` then overwrites by email at `store.go:18`. Duplicate emails
within one file are consequently counted multiple times even though they leave
one stored subscriber; reruns also report the input row count rather than a
change or committed subscriber count. The confirmation can therefore look
correct while the partner finds fewer subscribers.

**Recommendation:** define and report separate totals for rows read, rows
accepted, duplicates/updates, and unique subscribers committed. Normalize the
identity key before deduplication and make the idempotency/upsert rule explicit.

## 4. Validation is too weak and rejected rows are invisible

At `main.go:17`, a row is accepted if it has three columns and a non-empty
second column. Email syntax, whitespace-only values, plan validity, and
possibly required header/column semantics are not checked. Invalid data can
be stored under unusable keys, while rows that fail the check are silently
skipped and only represented by an aggregate count. Operators cannot identify
which subscribers were omitted or correct the source file from the confirmation.

**Recommendation:** validate and normalize fields at the CSV boundary, report
row-level rejection reasons (or a retrievable import report), and use an
explicit schema/version or column-name mapping rather than positional fields
alone.

## 5. `Count` has an unsynchronized map read

`store.Save` locks the map (`store.go:15-19`), but `Count` reads it without the
mutex (`store.go:21`). If counting occurs while an import is saving, Go can
race or panic with “concurrent map read and map write.” There is currently no
CLI call to `Count`, so the production trigger is not visible in this small
repository, but the exported store API is unsafe for the concurrent use its
mutex otherwise suggests.

**Recommendation:** protect `Count` with the same lock (or use a consistent
store abstraction), and add a focused concurrent test/run under the race
detector.

## Verification and uncertainty

I inspected every repository source and documentation file. No application
files were changed. I attempted `go test ./...`, `go vet ./...`, and
`go build ./...`, but the environment does not have the `go` executable, so
those checks could not run. There are no repository tests. Runtime behavior
against a real partner file and the intended persistence/validation contract
remain unverified.
