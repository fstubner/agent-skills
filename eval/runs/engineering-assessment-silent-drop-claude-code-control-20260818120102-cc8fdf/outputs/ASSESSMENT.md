# Assessment: Subscriber Import Tool Findings

## Summary
The import tool reports success but subscribers disappear because the system lacks persistent storage. Combined with silent error handling and incomplete validation, the operator cannot detect when imports fail.

---

## Finding 1: No Persistent Storage (Critical)
**File:** `internal/store/store.go:12`  
**Impact:** All imported subscribers are lost when the program terminates.

The store uses an in-memory map (`items = map[string]Subscriber{}`) initialized at module load time. When the `main` program exits, all subscribers vanish. The runbook expects operators to "run it again" if counts look wrong, implying data should persist across runs, but no database, file, or external storage is implemented.

**Why subscribers are missing:** They were imported into memory but never persisted to any durable storage system.

---

## Finding 2: Silent File Operation Failures (High)
**File:** `cmd/importer/main.go:12-13`  
**Impact:** Corrupted/missing CSVs are processed as empty, but success is still reported.

Both `os.Open()` and `csv.NewReader().ReadAll()` errors are discarded (`file, _ :=` and `rows, _`). If the file doesn't exist, can't be read, or is corrupted, the program silently proceeds with zero rows, then prints "imported 0 of 0 rows" as if successful. The operator cannot distinguish between an empty valid CSV and a failed file read.

**Scenario:** Operator runs `importer corrupted.csv`. File cannot be parsed. Program reports "imported 0 of 0 rows" and exits silently. Operator forwards this as success to the partner, who believes the import succeeded.

---

## Finding 3: Unguarded Command-Line Argument Access (High)
**File:** `cmd/importer/main.go:12`  
**Impact:** Program crashes if run without filename argument.

The code accesses `os.Args[1]` without checking slice length. Running `importer` with no arguments causes a panic (index out of range). Even though errors are being ignored silently elsewhere, a panic here crashes the process ungracefully.

**Scenario:** Operator forgets the filename: `importer`. Program panics instead of printing usage help.

---

## Finding 4: No Retrieval or Verification Function (Medium)
**File:** `internal/store/store.go:21`  
**Impact:** Cannot query or verify imported subscribers.

The `Count()` function exists but is unused by main. No `GetAll()`, `Get(email)`, or query mechanism exists. After import completes, the operator cannot run a command to verify the subscribers are actually in the system—they only have the printed count, which is unreliable without persistent storage.

---

## Finding 5: Incomplete Validation Masks Real Issues (Medium)
**File:** `cmd/importer/main.go:17-19`  
**Impact:** Validation failures are silently skipped without operator notification.

Validation checks only `len(row) < 3 || row[1] == ""`. This silently discards:
- Rows with fewer than 3 columns (without explaining why they were skipped)
- Rows with empty email addresses (no count of rejected rows provided)
- Rows with invalid email formats (no validation)
- Rows with invalid plan names (no validation)

The operator receives only "imported X of Y rows" with no indication of how many rows were rejected or why. A CSV with many invalid emails appears as a successful import of fewer rows, masking data quality issues.

---

## Verification Summary
- Confirmed in-memory storage by examining `internal/store/store.go` initialization
- Confirmed error handling bypasses by tracing `os.Open()` and `csv.ReadAll()` calls
- Confirmed no persistence layer exists (no SQL, file, or API calls in codebase)
- Confirmed `Count()` is unused and no retrieval function exists
- Confirmed validation only checks two conditions with no skip reporting
