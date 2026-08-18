# Assessment: Missing Subscribers After Import

## Summary
The importer tool reports success but subscribers are missing because the implementation has no persistent storage mechanism. Data imported is stored only in memory and is lost when the program exits. This is the root cause of the discrepancy between reported row counts and actual data retention.

## Critical Findings

### 1. No Persistence Mechanism (Highest Impact)
**File:** `internal/store/store.go:12`  
**Issue:** The `items` map is a package-level variable that exists only in memory during program execution. It is never persisted to disk, database, or any other durable storage. When the program exits, all imported data is lost.  
**Evidence:** The `Store` package has no database connection, file I/O, or any persistence logic. The `Save()` function only writes to the in-memory map. Once the process terminates, the map is garbage collected.  
**Impact:** Partners receive a report saying subscribers were imported (e.g., "imported 95 of 100 rows"), but the subscribers never actually persist. Any downstream system relying on the imported data will not see it.

### 2. Misleading Success Reporting
**File:** `cmd/importer/main.go:24`  
**Issue:** The printed message "imported X of Y rows" conflates two different counts. The denominator (`len(rows)-1`) includes ALL rows in the CSV, but the numerator (`imported`) only includes rows that passed basic validation. This creates ambiguity about whether failures are expected or indicative of a real problem.  
**Evidence:** Rows are skipped if `len(row) < 3 || row[1] == ""` (lines 17-19), but the success message doesn't report how many rows were skipped or why. A partner seeing "imported 80 of 100" cannot determine if 20 rows were legitimately skipped or if there's a data quality issue.  
**Impact:** Partners cannot distinguish between normal validation failures and silent data loss, making it impossible to verify that imports were actually successful.

### 3. Incomplete Input Validation
**File:** `cmd/importer/main.go:17`  
**Issue:** The validation logic only checks row length and email emptiness. It does not validate email format, plan legitimacy, required fields, or other data integrity constraints. The README states "rows that fail validation are skipped," implying robust validation, but the implementation is minimal.  
**Evidence:** An email like "not-an-email" would pass validation. A plan value that is empty string (spaces-only) would be accepted. Malformed CSVs are not detected.  
**Impact:** Invalid subscriber data can pass through validation and (if persistence existed) would be stored in the system, causing downstream failures or data corruption.

### 4. No Error Handling for File Operations
**File:** `cmd/importer/main.go:12-13`  
**Issue:** Errors from `os.Open()` and `csv.NewReader(file).ReadAll()` are silently ignored using blank identifiers. If the file does not exist, is not readable, or contains malformed CSV, the program will crash or produce no useful feedback.  
**Evidence:** Both calls use `_` to discard errors. If `os.Open()` fails, `file` will be nil and subsequent operations will panic. If CSV parsing fails, the program will not detect it.  
**Impact:** The operator cannot reliably detect failed imports. The tool may crash without any indication of the problem, and partners will not receive accurate confirmation.

### 5. No Idempotency or Duplicate Detection
**File:** `internal/store/store.go:18`  
**Issue:** The store uses email as a map key, which provides deduplication within a single run but only at the in-memory level. If the same CSV is imported twice (as the runbook suggests is safe), there is no mechanism to detect or prevent duplicate subscriptions beyond overwriting in a transient map.  
**Evidence:** The `Save()` function simply overwrites `items[s.Email]` with no check for prior existence or logging of duplicates. The runbook states "imports are safe to repeat" but the store has no way to enforce or validate this idempotency.  
**Impact:** If persistence existed and the same CSV is imported multiple times, subscribers would be duplicated in the actual system. The lack of duplicate detection also prevents accurate reporting of what was actually new vs. re-imported.

---

## Verified Observations
- All files in the workspace were reviewed: main importer logic, store package, README, and runbook.
- The store package contains no database drivers, file I/O, or persistence calls.
- Error handling is absent from critical file and CSV parsing operations.
- The validation logic is strictly limited to row length and email emptiness checks.
- The success message does not provide sufficient detail to distinguish skipped rows from actual imports.
