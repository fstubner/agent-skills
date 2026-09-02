# Import Failure Assessment

## Summary
Subscribers are missing after imports because the application has no persistence layer. Imported data is stored only in memory and discarded when the process exits. The tool reports success based on in-memory counts, creating a false impression of successful data persistence.

## Findings (Priority Order)

### 1. **No Persistence Layer** (Critical)
**File:** `internal/store/store.go`  
**Issue:** Subscribers are stored only in an in-memory map (`items = map[string]Subscriber{}`). Data is lost when the process terminates.

**Evidence:** Line 12 shows volatile map storage with no file, database, or external persistence mechanism. The `Count()` function (line 21) reports length of this ephemeral map, not persistent state.

**Impact:** Every import loses all data when the importer exits. Partners receive success reports for data that no longer exists after the program terminates.

---

### 2. **Silent Error Suppression on File Operations** (Critical)
**File:** `cmd/importer/main.go`, lines 12-13  
**Issue:** File open and CSV parsing errors are silently discarded using blank identifiers (`_`).

```go
file, _ := os.Open(os.Args[1])
rows, _ := csv.NewReader(file).ReadAll()
```

**Impact:** If a file cannot be opened or parsed, the program proceeds with an empty rows slice, reports "imported 0 rows", and the operator assumes failure. However, if file operations partially fail mid-process, the operator may not detect data loss and report success to the partner.

---

### 3. **No Data Verification After Import** (High)
**File:** `internal/store/store.go` - store module lacks query interface  
**Issue:** The store only provides `Count()`. There is no way to verify imported data was actually persisted or to retrieve it.

**Evidence:** No `Get()`, `List()`, or `Query()` functions exist. The importer cannot prove the subscribers exist after saving.

**Impact:** Operators cannot independently verify that the imported data survived. The success report is based solely on an in-memory count with no post-import audit capability.

---

### 4. **Insufficient Input Validation** (High)
**File:** `cmd/importer/main.go`, lines 17-19  
**Issue:** Validation only checks row length and email emptiness. No email format, plan validity, or required field checks exist.

```go
if len(row) < 3 || row[1] == "" {
    continue
}
```

**Impact:** Invalid data (malformed emails, empty plans) may be "imported" to memory, counted as success, then lost. Invalid data in CSV files is silently skipped but counted as row failures, providing false confidence in data quality.

---

### 5. **No Audit Trail or Import Logging** (Medium)
**File:** Both files  
**Issue:** No logging of what was imported, when, or which rows failed validation.

**Evidence:** Only a single success message is printed. No per-row logging, no error summary, no timestamp, no identification of which rows were rejected.

**Impact:** When subscribers are missing, there is no audit trail to investigate what happened. Partners cannot trace which specific rows were imported or rejected. Re-running an import provides no ability to detect whether duplicates or data drift occurred.

---

## Architectural Issue

The design assumes import success means data persistence, but success only means "data loaded to RAM". This violates the trust boundary principle: validation and success reporting must occur at the persistence layer, not the processing layer. Importing to an ephemeral in-memory store then reporting success creates a false guarantee of data durability.

## Verification Notes

- Confirmed no database, file, or external storage integration exists
- Confirmed all error handling uses blank identifiers
- Confirmed store module has no query/retrieval capability
- Confirmed validation logic is minimal
- Confirmed no logging or audit trail implementation
