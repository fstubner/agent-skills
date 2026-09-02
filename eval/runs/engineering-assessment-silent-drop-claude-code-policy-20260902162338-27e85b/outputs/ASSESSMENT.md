# Assessment: Missing Subscribers After Import

## Summary
The import tool reports success but subscribers are missing because all imported data is stored only in-memory and discarded when the program exits. This explains why the partner observed successful completion with no persistent data.

## Findings

### 1. **No Data Persistence — Critical** (store.go:10-13)
The `items` map stores all subscriber data in-memory only. When the importer process terminates, all imported subscribers are lost. The store has no persistence layer (database, file, or external service), making it impossible for the data to survive beyond the single execution.

**Impact**: Every import is lost immediately after the program exits, explaining the partner's missing subscribers.

---

### 2. **Unhandled File and CSV Parse Errors** (cmd/importer/main.go:12-13)
Both `os.Open()` and `csv.NewReader().ReadAll()` errors are silently discarded with `_`. If the input file is missing, corrupted, or unreadable, the program will crash at runtime with no error message, and the partner will receive no failure notification.

**Impact**: Broken imports go undiagnosed; partners cannot distinguish between partial success and total failure.

---

### 3. **Insufficient Email Validation** (cmd/importer/main.go:17)
The code only checks `len(row) < 3 || row[1] == ""`. This allows:
- Emails with spaces, special characters, or invalid format
- Missing or empty Plan field (row[2]) with no validation
- Rows with arbitrary trailing data to pass through

**Impact**: Invalid data pollutes the subscriber database; no way to filter or correct bad imports.

---

### 4. **No Access to Stored Data** (store.go:21)
The `Count()` function exposes only the count of subscribers. The `items` map is unexported and has no retrieval API. External systems (e.g., email service, UI, reporting) cannot enumerate or access imported subscribers—only count them.

**Impact**: Imported subscribers cannot be synced to dependent systems; operators cannot verify what was actually imported.

---

### 5. **No Idempotency Guarantee** (cmd/importer/main.go:16-22)
The runbook states "imports are safe to repeat," but the current implementation offers no idempotency check. Running the same CSV twice adds duplicate records (overwriting by email key masks this for in-memory storage, but would cause duplicates in any real persistence layer). There is no tracking of which imports have been processed.

**Impact**: Manual retry workflows create unpredictable results; true replay safety is not achieved.

---

## Verification Performed
- Reviewed Go source code in `cmd/importer/main.go` and `internal/store/store.go`
- Analyzed CSV parsing and storage logic
- Examined error handling paths
- Confirmed absence of persistence layer, validation functions, and data retrieval APIs
- Checked documentation (README, runbook) against implementation
