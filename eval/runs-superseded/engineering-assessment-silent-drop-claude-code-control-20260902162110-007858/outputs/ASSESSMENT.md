# Subscriber Import Assessment

## Issue Summary
The subscriber importer reports successful imports but data does not persist. Analysis reveals critical architectural and implementation gaps.

---

## Findings

### 1. **No Persistent Storage Mechanism (Critical)**
**File**: `internal/store/store.go` (lines 10-19)

The subscriber data is stored exclusively in an in-memory Go map (`items`). There is no database, file system, or any other persistence layer. When the importer process exits, all imported data is lost. 

Each CLI invocation creates a new process with a fresh, empty map. This directly explains why subscribers are missing after import—the reported success count reflects only rows that passed validation, not actual data persistence. The tool reports success without writing data anywhere durable.

**Impact**: Complete data loss on every import; subscribers never survive past program termination.

---

### 2. **Unhandled Critical Errors in File I/O (High)**
**File**: `cmd/importer/main.go` (lines 12-13)

Both `os.Open()` and `csv.NewReader(file).ReadAll()` errors are silently ignored using blank identifiers (`_, _`):
```go
file, _ := os.Open(os.Args[1])
rows, _ := csv.NewReader(file).ReadAll()
```

If the CSV file doesn't exist, is unreadable, or contains malformed data, these calls fail silently. The program will proceed with zero rows and report "imported 0 of 0 rows" or panic on nil pointer access, without informing the operator of the actual failure reason.

**Impact**: Silent failures hide data import problems from operators; false negatives reported to partners.

---

### 3. **Success Reporting Decoupled from Actual Persistence (High)**
**File**: `cmd/importer/main.go` (lines 24)

The tool reports `"imported X of Y rows"` based only on rows passing basic validation (non-empty email, minimum fields). It never verifies that `store.Save()` actually succeeded or that data persisted:

```go
store.Save(store.Subscriber{Email: row[1], Plan: row[2]})
imported++  // Count incremented regardless of save outcome
```

The count reflects validation pass-through, not successful storage. Combined with finding #1, this creates a false confidence signal to partners.

**Impact**: Partners receive incorrect confirmation of data import; no early detection of storage failures.

---

### 4. **Insufficient Input Validation (Medium)**
**File**: `cmd/importer/main.go` (lines 17)

Validation only checks row length and email non-emptiness:
```go
if len(row) < 3 || row[1] == ""
```

This allows:
- Invalid email formats (no validation beyond "not empty")
- Missing or invalid `Plan` values (column 2 is accepted without any checks)
- No detection of duplicate emails within the same import (deduplication missing)
- No enforcement of expected plan types or ranges

Invalid subscriber records could be imported and stored (if persistence existed) without operator awareness.

**Impact**: Data quality degradation; inconsistent downstream processing of invalid plan values.

---

### 5. **Store Design Incompatible with CLI Deployment Model (Medium)**
**File**: `internal/store/store.go` (lines 3, 11, 15-19)

The store module uses module-level state (`items` map) and mutex-protected access (`sync.Mutex`), suggesting it's designed for concurrent multi-process server access. However, it's deployed as a single-shot CLI tool that exits immediately after each import.

The architectural mismatch means:
- Mutex contention protection is unused (single-threaded per invocation)
- Module-level state cannot be shared across process boundaries
- No initialization, connection pooling, or lifecycle management

**Impact**: Architectural debt; prevents scaling to multi-threaded or multi-process scenarios; suggests incomplete system design.

---

## Verification Performed
- Source code review of `cmd/importer/main.go`, `internal/store/store.go`, README, and runbook
- Static analysis of error handling, validation logic, and data flow
- Assessment of storage architecture against deployment model (CLI tool vs. in-memory server state)
