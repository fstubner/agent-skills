# Assessment: Subscriber Import Data Loss

## Summary
The import tool reports success but subscribers are missing because the application has no data persistence mechanism. Imported data is stored only in memory and is lost when the process exits.

## Five Highest-Value Findings

### 1. **No Data Persistence (CRITICAL)**
**File**: `internal/store/store.go:10-13`  
**Issue**: Subscribers are stored in an in-memory map that is never persisted to disk or database.  
**Impact**: All imported subscribers are lost when the program terminates. This directly explains why subscribers go missing after import despite success reports.  
**Evidence**: The `items` map is package-level with no database, file, or other persistence layer. The `Save()` function only writes to this map.

### 2. **Silent Error Handling - File Operations**
**File**: `cmd/importer/main.go:12-13`  
**Issue**: Errors from `os.Open()` and `csv.NewReader().ReadAll()` are ignored via blank imports `_`.  
**Impact**: If the CSV file cannot be opened, is malformed, or is unreadable, the tool silently proceeds without any diagnostic information. The operator receives no indication of failure.  
**Example**: A permissions error or missing file would result in "imported 0 of 0 rows" with no error message, masking data loss.

### 3. **Race Condition in Count() Function**
**File**: `internal/store/store.go:21`  
**Issue**: `Count()` reads from the shared `items` map without acquiring the mutex, while `Save()` holds the mutex when modifying it.  
**Impact**: Concurrent calls to `Count()` and `Save()` can result in reading stale or inconsistent data. This violates Go's memory safety model for concurrent map access.  
**Note**: Though the comment in the runbook suggests running imports serially, this creates undefined behavior if that assumption breaks.

### 4. **No Email Format Validation**
**File**: `cmd/importer/main.go:17`  
**Issue**: Validation only checks if `row[1]` is non-empty (`row[1] == ""`), but does not validate email format.  
**Impact**: Invalid email addresses (e.g., "not-an-email", "@example.com", "user@") are accepted and stored, creating data quality issues downstream.  
**Expected**: Email validation should check for basic format (e.g., contains "@" and a domain).

### 5. **Silent Duplicate Overwriting**
**File**: `internal/store/store.go:18` and `cmd/importer/main.go:20`  
**Issue**: When duplicate emails appear in a CSV, the second occurrence silently overwrites the first in the map. No log, no counter, no user notification.  
**Impact**: If a partner's CSV contains duplicate rows (common in real data), the importer silently discards earlier instances and reports the total row count, creating false confidence in data accuracy. The partner has no visibility into how many duplicates were merged.  
**Example**: A CSV with 100 rows, 20 unique emails would report "imported 100 of 100 rows" but actually store 20 subscribers.

## Verified
- Repository structure and all code files examined
- No database or file persistence layer exists
- Error handling confirmed as silent (blank imports)
- Mutex usage in store package confirmed as incomplete
- CSV validation logic confirmed as insufficient
- Runbook expectations vs. actual implementation verified
