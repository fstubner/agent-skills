# Assessment: Missing Subscribers After Import

## Summary
The importer reports successful imports, but all subscriber data is lost immediately because it's stored only in-memory and never persisted to any database or permanent storage.

## Findings

### 1. **No Persistence Mechanism (Critical)**
**Location**: `internal/store/store.go:12`

The subscriber data is stored in a module-level Go map (`items = map[string]Subscriber{}`), which exists only in the program's memory. When the importer process exits, all stored data is completely lost. No database, file, or other persistent storage exists to save the imported subscribers.

**Impact**: Every import reports success but leaves zero subscribers in the system. The partner's data appears to have been imported (tool confirms it) but is actually discarded.

---

### 2. **Silent Error Handling on File/CSV Operations (Critical)**
**Location**: `cmd/importer/main.go:12-13`

```go
file, _ := os.Open(os.Args[1])
rows, _ := csv.NewReader(file).ReadAll()
```

Both the file open and CSV parsing operations use blank identifiers to discard errors. If the file doesn't exist or the CSV is malformed, the program crashes or proceeds with empty data without any error message to the operator.

**Impact**: Import failures are indistinguishable from successful imports, giving false confidence to the operator.

---

### 3. **Duplicate Emails Silently Overwrite in Map (High)**
**Location**: `internal/store/store.go:18` and `cmd/importer/main.go:20-21`

The store uses email as the map key. If a CSV contains duplicate emails (same subscriber row twice), the store only retains the last occurrence, but the import counter increments for each valid row processed.

**Impact**: A CSV with 100 rows where 50 are duplicates would report "imported 100 rows" but actually store only ~50 unique subscribers. The discrepancy goes unreported.

---

### 4. **No Email Validation (Medium)**
**Location**: `cmd/importer/main.go:17`

The validation only checks if `row[1]` is not empty (`row[1] == ""`), but doesn't validate email format. Any non-empty string passes validation and is stored as an email.

**Impact**: Invalid email addresses are counted in the import and stored in memory, potentially corrupting the subscriber database with unusable data when (if) it were persisted.

---

### 5. **Plan Field Never Validated (Medium)**
**Location**: `cmd/importer/main.go:17-20`

The validation checks row length and email presence but doesn't validate `row[2]` (Plan) for valid values. The Plan field is directly stored without checking if it's empty, valid, or matches expected plan types.

**Impact**: Invalid or empty plan data is silently accepted, and subscribers could be stored with unactionable plan information.

---

## Verified
- Code structure: 1 main importer and 1 store module
- Storage mechanism: In-memory map only, no persistence layer
- Error handling: Uses blank identifiers to discard all errors
- Validation: Minimal (row length and email non-empty only)
