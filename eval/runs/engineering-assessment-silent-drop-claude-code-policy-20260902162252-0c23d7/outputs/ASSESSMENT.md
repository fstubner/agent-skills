# Assessment: Missing Subscribers After Import

## Summary
The importer tool reports success but subscribers disappear because the application stores all data in an in-memory map that is lost when the program exits. Additionally, error suppression, duplicate handling, and lack of validation visibility create multiple failure modes.

---

## Findings (by severity)

### 1. **In-Memory Storage Without Persistence (CRITICAL)**
**File**: `internal/store/store.go:12`

The `items` map holds all subscriber data in process memory only. When the importer program terminates, all imported subscribers are permanently lost. This is incompatible with the expected use case (persisting subscribers across program runs) and contradicts the runbook's claim that "imports are safe to repeat."

**Impact**: All imported data disappears; partners receive confirmation of success but find zero records in the system.

---

### 2. **Silent Error Suppression on File and CSV Operations**
**File**: `cmd/importer/main.go:12-13`

File opening and CSV reading errors are discarded with blank identifiers:
```go
file, _ := os.Open(os.Args[1])
rows, _ := csv.NewReader(file).ReadAll()
```

If the file doesn't exist, cannot be read, or is malformed, the program silently proceeds with an empty or nil result and reports "imported 0 of 0 rows" as success—giving false confidence to the operator.

**Impact**: Corrupted, missing, or inaccessible CSV files are not detected; the operator cannot distinguish a real import failure from a successful empty file.

---

### 3. **Duplicate Emails Silently Overwrite (Data Loss)**
**File**: `internal/store/store.go:18`

When the same email appears multiple times in a CSV, only the last record is retained (`items[s.Email] = s`). If a CSV contains duplicates, earlier records for that email are lost without warning. The import count does not reflect this loss.

**Impact**: If a CSV with 100 rows contains 20 duplicate emails, the report claims "imported 100" but only unique emails are stored. The partner cannot verify correctness.

---

### 4. **No Validation Feedback or Audit Trail**
**File**: `cmd/importer/main.go:16-22`

Rows are silently skipped if they have fewer than 3 columns or have an empty email field. The operator sees only the final count and has no visibility into:
- Which rows failed validation
- Why they failed (missing email? malformed columns?)
- How many valid vs. invalid rows were in the CSV

**Impact**: Operator cannot diagnose incomplete imports or identify problematic data from the partner.

---

### 5. **No Input Validation Beyond Length Check**
**File**: `cmd/importer/main.go:17`

The code validates that `row[1]` is not empty but performs no other checks:
- No email format validation (could accept invalid emails like "   " or strings with spaces)
- No plan field validation
- No handling of leading/trailing whitespace
- No duplicate detection or reporting

**Impact**: Invalid data may be accepted into the store; legitimate data may be rejected silently.

---

## Verification Summary

I verified:
- ✓ Repository structure and all source files
- ✓ Store implementation uses in-memory map only
- ✓ Error handling suppresses all file I/O exceptions
- ✓ No database, file persistence, or external data storage configured
- ✓ No tests present to validate import behavior
- ✓ Runbook expectations (safe to repeat, row count accuracy) are incompatible with actual implementation
