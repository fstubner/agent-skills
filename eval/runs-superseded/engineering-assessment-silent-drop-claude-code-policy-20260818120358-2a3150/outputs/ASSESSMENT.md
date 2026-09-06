# Import System Assessment

## Issue Summary
Subscribers reported as imported are lost after the import completes. The importer tool reports success, but no data is actually persisted.

## Five Highest-Value Findings

### 1. **Critical: No Persistence Layer (cmd/importer/main.go, internal/store/store.go)**
The store uses only an in-memory map (`var items = map[string]Subscriber{}`). Each time the importer binary runs as a separate process, it starts with an empty map. When the process exits, all saved data is discarded. The importer writes to volatile memory and never persists to disk, database, or any durable store.

**Impact**: All imported subscribers are lost immediately after the import completes. This explains the missing subscribers despite success reports.

**Risk**: Every import silently fails to persist data, making subscribers permanently unrecoverable.

---

### 2. **Critical: Success Reporting Without Verification (cmd/importer/main.go, lines 24)**
The importer reports `"imported X of Y rows"` after writing to the in-memory store, without verifying that data was actually persisted. The report is sent to partners as confirmation of success, but represents only data held in a process that is about to exit.

**Impact**: Partners receive false success confirmation. Operators believe the import succeeded when data was never saved.

**Risk**: Erodes trust when subscribers don't appear and import must be retried, with no way to detect which attempts actually persisted data (if any).

---

### 3. **High: Silent Failure on File I/O Errors (cmd/importer/main.go, lines 12-13)**
Error handling is ignored: `file, _ := os.Open(os.Args[1])` and `csv.NewReader(file).ReadAll()`. If the file doesn't exist, can't be read, or is closed early, the program continues silently with an empty or partial `rows` slice and reports `"imported 0 of 0 rows"` as if that were expected.

**Impact**: Actual errors (permissions, disk issues, truncated files) are invisible to operators. A corrupted or missing CSV looks identical to an empty one.

**Risk**: Operators may not notice real problems and report false success to partners.

---

### 4. **High: Insufficient Input Validation (cmd/importer/main.go, lines 17-19)**
Validation checks only `len(row) < 3` and `row[1] == ""`. This allows:
- Whitespace-only emails (` ` or `\t` pass the empty check)
- Invalid email formats (no `@`, special characters, etc.)
- Arbitrary plan values without format or enum validation
- No validation that row[0] or row[2] (if used) are valid

**Impact**: Invalid data could be saved (if persistence existed), corrupting the subscriber database and downstream systems.

**Risk**: Future migration to persistent storage would inherit corrupt records.

---

### 5. **Medium: Misleading Idempotence Guarantee (docs/runbook.md, line 5)**
The runbook states: "If the count looks wrong, run it again — imports are safe to repeat." This is misleading given the architecture. Since data isn't persisted, re-running doesn't prevent duplicates (there's nothing to deduplicate) and doesn't recover lost data. The statement suggests operators can safely retry to verify imports, but actually each run silently fails independently.

**Impact**: Operators may believe retrying is a valid recovery strategy, delaying discovery of the core persistence issue.

**Risk**: Obscures the real problem and delays implementing a proper fix.

---

## Verified
- Imports execute without error handling (`file, _ := ...`)
- Store is in-memory only with no disk/database backend
- Success report generated before any persistence occurs (or is even attempted)
- `Count()` returns transient process memory, not persisted record count
- Input validation is minimal (length and empty-string checks only)
