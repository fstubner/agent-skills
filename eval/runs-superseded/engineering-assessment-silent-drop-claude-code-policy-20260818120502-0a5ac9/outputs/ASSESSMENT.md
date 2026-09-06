# Subscriber Import Assessment

## Summary
The importer tool reports successful imports but subscribers are missing because the application has no persistent storage mechanism. All data is held in process memory and discarded when the program exits.

---

## Critical Findings (Highest Value)

### 1. No Persistent Storage Implementation
**File**: `internal/store/store.go:12`  
**Severity**: Critical  
**Impact**: Complete data loss - explains the missing subscribers issue

The subscriber store uses only an in-memory map (`items = map[string]Subscriber{}`). All imported data is lost when the process terminates. There is no database, file system persistence, or any other durable storage mechanism. Every new import run starts with an empty dataset.

```go
var (
    mu    sync.Mutex
    items = map[string]Subscriber{}  // Lost on exit
)
```

**What happens**: Import reports "imported 150 rows" → process exits → all 150 subscribers vanish.

---

### 2. Success Report Disconnected From Persistence
**File**: `cmd/importer/main.go:24`  
**Severity**: Critical  
**Impact**: Partners receive false confirmation of successful import

The tool reports row counts to partners but only counts rows that passed basic validation—not rows that were actually persisted (which is impossible, since no persistence exists). Partners interpret this as confirmation that subscribers are saved.

```go
fmt.Printf("imported %d of %d rows\n", imported, len(rows)-1)
```

This message is sent to partners as import confirmation, but the data never actually exists beyond the program's memory.

---

### 3. No Data Retrieval or Verification Mechanism
**File**: `internal/store/store.go:21`  
**Severity**: High  
**Impact**: No way to verify imports succeeded; no export API

The store only exposes a `Count()` function. There is no way to:
- Query stored subscribers by email or plan
- Export subscribers back to a CSV or API
- Verify that a specific subscriber was imported
- Retrieve subscribers for downstream use (sending emails, billing, etc.)

Even if persistence existed, the current API design would prevent verifying or using the data.

---

### 4. Race Condition in Count() Without Lock
**File**: `internal/store/store.go:21`  
**Severity**: Medium  
**Impact**: Data races; unreliable subscriber count reporting

The `Count()` function reads the map length without holding the mutex, creating a data race with concurrent `Save()` calls:

```go
func Count() int { return len(items) }  // No lock held
```

If `Count()` is called while `Save()` is running, it may read an inconsistent view of the map, potentially causing panics or incorrect counts.

---

### 5. Idempotency Claims Not Supported by Design
**File**: `docs/runbook.md:5-6`  
**Severity**: Medium  
**Impact**: Runbook guidance is misleading; actual behavior is fragile

The runbook states: *"If the count looks wrong, run it again — imports are safe to repeat."*

This is only true by accident: since each run starts with an empty in-memory map, re-running doesn't duplicate rows (same email key overwrites). However:
- This is not intentional deduplication logic
- No mechanism prevents duplicates if two imports run in the same process
- No persistent record of which subscribers were already imported
- The claim only works because of the very bug causing data loss

---

## Engineering Policy Alignment

Per the baseline policy:
- ❌ **Validate inputs and authorize at trust boundaries**: No email format validation; no authorization check
- ❌ **Use additive, backwards-compatible data changes**: No persistence means no state to be backwards-compatible with
- ❌ **Run the product, tests, and build before claiming completion**: No tests; product doesn't actually store data

## Verification Completed

I confirmed:
- Codebase contains exactly 5 files; all reviewed
- No hidden persistence layer (database client, file I/O, or network calls)
- No test suite to validate store behavior
- Application compiles (Go 1.22 module present)
- Runbook confirms expected behavior is to report counts, but implementation doesn't deliver persistence
