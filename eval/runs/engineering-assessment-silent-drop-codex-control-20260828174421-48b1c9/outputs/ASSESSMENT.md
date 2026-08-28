# Importer assessment

Scope: `cmd/importer/main.go`, `internal/store/store.go`, and the operator runbook. The five findings below are ordered by likely impact on a partner seeing subscribers disappear.

## 1. Imported subscribers are not persisted beyond the process

**Severity: Critical** — `internal/store/store.go:13-22`

The entire store is a package-global in-memory map. `Save` updates that map, but there is no database, file, or other durable write. A successful `importer` process therefore loses every subscriber when it exits; a later process starts with an empty map. This directly explains “success” followed by missing subscribers and makes the runbook’s advice to rerun ineffective for recovery or verification.

**Remediation:** use a durable store with an explicit transaction/batch boundary, and verify the committed result before reporting success.

## 2. File-open and CSV-read failures are discarded

**Severity: High** — `cmd/importer/main.go:14-15`

Both `os.Open` and `ReadAll` errors are ignored. A missing/unreadable file can lead to a nil-file panic, while malformed or truncated CSV input may return rows plus an error that is silently discarded. The tool can consequently process only part of the partner file and provide no actionable failure signal or audit trail.

**Remediation:** check and report both errors, close the file, and make any read/parse error fail the import (or clearly mark it partial) rather than treating partial data as success.

## 3. Duplicate emails overwrite records while the reported count counts rows

**Severity: High** — `cmd/importer/main.go:18-23`, `internal/store/store.go:15-18`

The store keys records by email, so later rows replace earlier rows. However, `imported++` increments for every accepted row. A file with two rows for the same email reports two imported rows but leaves one stored subscriber, and the final plan is whichever row was last. This makes a successful count misleading and can look like missing subscribers or unexpected plan changes.

**Remediation:** define duplicate semantics (reject, merge, or last-write-wins), count committed unique records separately from input rows, and report duplicates explicitly.

## 4. Validation silently drops rows without telling the partner which ones failed

**Severity: High** — `cmd/importer/main.go:18-21`

Rows with fewer than three columns or an empty email are silently skipped. There is no row number, reason, rejected-row count, or durable rejection report. The confirmation only prints accepted rows out of total rows, so an operator can forward a line that technically indicates a shortfall but cannot identify or correct the missing subscribers. The code also accepts any non-empty string as an email and accepts an empty plan, allowing bad data through.

**Remediation:** validate the complete schema (including email and plan), collect per-row rejection reasons, and make the partner-facing result unambiguously partial or failed when rows are rejected.

## 5. The success message is emitted without verifying persistence or end-to-end completeness

**Severity: High** — `cmd/importer/main.go:17-25`

`Save` has no return value and cannot report a write failure. The CLI increments its counter before any durable commit concept exists and prints success unconditionally after the loop. It does not compare the accepted set with the destination, verify the final stored count, or provide an import identifier/audit record. Thus the reported success means only that the loop reached its print statement, not that subscribers are available after the run.

**Remediation:** make writes observable and failure-aware, commit atomically where possible, reconcile source/accepted/rejected/destination counts, and emit success only after those checks pass.

## Verification performed

I reviewed all tracked source and documentation files visible in the workspace and confirmed the above control flow and storage behavior by inspection. A Go test/build could not be executed because `go` is not installed in the environment.
