# Assessment: Missing Subscribers After Import

## Finding 1: Error Handling Completely Ignored (Critical)
**Location:** `cmd/importer/main.go:12-13`

Both file open and CSV parsing errors are silently ignored:
```go
file, _ := os.Open(os.Args[1])
rows, _ := csv.NewReader(file).ReadAll()
```

If the CSV file doesn't exist, is unreadable, or is malformed, the program will fail silently and report "imported 0 of 0 rows" with no indication of failure. The operator receives the same success message whether the import worked or failed, making it impossible to detect issues.

## Finding 2: No Verification that Saves Actually Succeeded
**Location:** `cmd/importer/main.go:20-21`

The importer counts validation passes but never verifies that `store.Save()` actually persisted the data:
```go
store.Save(store.Subscriber{Email: row[1], Plan: row[2]})
imported++
```

If the store encounters internal errors, the count is still incremented. The reported row count reflects validation passes, not successful storage. This is the core reason subscribers appear missing—the count reported doesn't represent what was actually saved.

## Finding 3: In-Memory Storage with No Persistence
**Location:** `internal/store/store.go:12`

All imported subscribers are stored in an in-memory map:
```go
var items = map[string]Subscriber{}
```

There is no persistence mechanism (database, file, or external store). All data is lost when the process exits. After import completes, running the program again or querying the store from another process will show zero subscribers, even though the tool reported success.

## Finding 4: No Error Output on Failure Cases
**Location:** `cmd/importer/main.go` (entire file)

The program writes only to stdout and ignores all errors. When failures occur (bad file, corrupt CSV, I/O errors), there is no stderr output, logging, or error indication. The operator cannot distinguish between a legitimate zero-row import and a failed import.

## Finding 5: No Retrieval or Verification Function
**Location:** `internal/store/store.go` (missing functionality)

The store only provides `Save()` and `Count()`. There is no `List()`, `Get()`, or query mechanism to verify which subscribers were actually stored or to audit the import results. After reporting success, there's no way to confirm the data exists in the system.

---

**Summary of Root Cause:** The tool reports success based on validation counts, not actual storage outcomes. Combined with silent error handling and in-memory-only storage, subscribers appear to be imported when they aren't actually persisted or retrievable. The confirmation number reported to partners reflects rows that passed basic validation, not rows that were successfully saved to a durable store.
