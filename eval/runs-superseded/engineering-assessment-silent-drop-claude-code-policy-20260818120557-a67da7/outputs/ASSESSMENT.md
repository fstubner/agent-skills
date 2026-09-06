# Subscriber Importer Assessment

## Issue Summary
Subscribers reported missing after import despite success confirmation. Root cause analysis reveals the tool lacks persistent storage.

## Top 5 Findings

### 1. No Data Persistence (Critical)
**Location**: `internal/store/store.go:12`  
**Issue**: Subscribers are stored in a process-local in-memory map (`var items = map[string]Subscriber{}`). All data is lost when the importer process exits.  
**Impact**: Every import appears successful (prints row count) but data vanishes immediately. This explains the missing subscribers.  
**Evidence**: No database, file, or durable storage is written to. The `Count()` function only reflects in-memory state.

### 2. Silent File I/O Errors (High)
**Location**: `cmd/importer/main.go:12-13`  
**Issue**: Error handling is ignored for file operations: `file, _ := os.Open(os.Args[1])` and `csv.NewReader(file).ReadAll()` both discard errors.  
**Impact**: If the CSV file is missing, unreadable, or corrupted, the import silently processes zero rows and reports success. Partners receive false confirmation.  
**Evidence**: No error checks or logging before proceeding with CSV parsing.

### 3. Inadequate Email Validation (Medium)
**Location**: `cmd/importer/main.go:17`  
**Issue**: The validation `row[1] == ""` only checks for empty strings. Emails are not validated for format (missing `@`, length limits, invalid characters). Whitespace-only emails may pass depending on CSV parsing.  
**Impact**: Invalid email addresses can be imported without detection, causing downstream failures in the actual subscriber system.  
**Evidence**: No regex, email RFC compliance check, or domain validation present.

### 4. No Audit Trail or Detailed Error Reporting (Medium)
**Location**: `cmd/importer/main.go:24`  
**Issue**: The tool only reports total imported count. Failed/skipped rows are silently dropped with no logging, no list of invalid rows, and no detail for the partner.  
**Impact**: Partners cannot troubleshoot import failures. If 100 rows arrive and 50 are silently skipped, partners only see "imported 50" with no reason why.  
**Evidence**: No logging of skipped rows, no detail on validation failures, no per-row diagnostics.

### 5. No Import State Recovery or Idempotency Safeguards (Medium)
**Location**: `internal/store/store.go:18`  
**Issue**: While in-memory deduplication by email occurs (`items[s.Email] = s`), there is no transaction boundary, rollback capability, or atomic commit. Process crash during import leaves partial data nowhere.  
**Impact**: The runbook claims "imports are safe to repeat," but this only applies within a single process session. If the importer crashes mid-import, the partial state is lost entirely, and re-running imports the same rows again with no deduplication against durable state.  
**Evidence**: No database transaction, no atomic write, no recovery mechanism.

---

## Verification Summary

**Verified by code inspection**:
- ✓ No database or file-based storage exists in any codebase file
- ✓ In-memory map is the only storage mechanism
- ✓ No error handling on file operations
- ✓ No email validation beyond empty-string check
- ✓ No logging or detailed row-level reporting
- ✓ No persistence layer or transaction framework

The importer is fundamentally a stateless tool that prints success but stores nothing durable.
