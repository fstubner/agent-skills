# Engineering Assessment: Subscriber Importer

## Scope

**In Scope:**
- `cmd/importer/main.go` — the import entry point and CSV processing logic
- `internal/store/store.go` — the data storage mechanism
- `go.mod` — dependency declarations
- Configuration and documentation files (`README.md`, `docs/runbook.md`)

**Out of Scope:**
- External services or databases (if any exist)
- Deployment infrastructure or environment configuration
- Integration tests or end-to-end workflows beyond the importer code

**Depth:** Targeted — all in-scope files examined in full.

---

## Environment

**Language & Runtime:** Go 1.22 (from go.mod)  
**Domain:** Data import utility (CSV to in-memory store)  
**Tooling:** Standard Go build toolchain (no external dependencies declared)

---

## What I Ran

The codebase is minimal with no build, test, or lint configuration. The following commands were attempted:

- **Go build:** Not executed (would require approval for shell execution). The code contains no syntax errors visible on inspection.
- **Tests:** No test files found in the repository.
- **Linting:** No linter configuration present.
- **Audit:** No dependencies to audit (go.mod contains only module declaration).

---

## Findings Table

| # | Severity | Area          | Finding | Evidence | Recommendation |
|---|----------|---------------|---------|----------|-----------------|
| 1 | Critical | Data Integrity | All imported data is permanently lost when the program exits; store is 100% in-memory with no persistence layer | `internal/store/store.go:10-13` — `items = map[string]Subscriber{}` is a module-level map with no database, file I/O, or persistence mechanism. Program exit causes total data loss. | Implement persistent storage: connect to a database (PostgreSQL, SQLite, etc.) and write each subscriber to disk before confirming success. Alternatively, append to a file or use a structured data format. The in-memory store must not be the only source of truth. |
| 2 | Critical | Reliability | Error codes from file open and CSV parsing are ignored, masking failures as success | `cmd/importer/main.go:12-13` — `os.Open()` and `csv.ReadAll()` errors are discarded with `_`. A missing file, unreadable CSV, or malformed data produces no error message; the program prints "imported 0 rows" and exits 0. | Capture and log all errors: check file open, CSV parsing, and store operations. Print diagnostics to stderr and exit with a non-zero code on failure. Ensure the operator knows the import failed. |
| 3 | Critical | Correctness | Import success is reported regardless of whether data was persisted; operator sends confirmation to partner despite data being lost | `cmd/importer/main.go:24` — the program always prints "imported X of Y rows" and exits successfully, even though the data exists only in memory and vanishes on exit. The runbook instructs the operator to forward this message to the partner as confirmation. | Combine findings #1 and #2: implement persistence and error handling. Only report success after data is durably written and verified. Add a verification step (e.g., re-read the persisted data to confirm row count) before printing success. |
| 4 | High | Maintainability | No mechanism to verify import integrity; duplicate detection is absent despite the runbook claiming imports are "safe to repeat" | `internal/store/store.go:18` — `items[s.Email] = s` overwrites any existing subscriber with the same email with no warning. `cmd/importer/main.go:16-22` performs no duplicate checking. Repeated imports with the same CSV will silently overwrite existing records, corrupting data. | Implement duplicate detection: query persistent storage before insert and either skip duplicates (with a count) or update the record conditionally. Document the merge strategy. The runbook's claim that imports are "safe to repeat" is false without idempotent logic. |
| 5 | High | Security | No input validation for email format; malformed email addresses are accepted and stored | `cmd/importer/main.go:17` — only checks `len(row) < 3 || row[1] == ""`. No email format validation (no regex, no RFC validation, no syntax check). Accepts nonsense like "not an email", "  ", or "@@@". | Add email validation before save: use `mail.ParseAddress()` from `net/mail` to ensure syntactic correctness, or apply a regex pattern. Reject invalid rows and report them in the output so the operator can correct the CSV. |

---

## Unconfirmed Issues

None. All findings are confirmed by code inspection.

---

## Summary

### Strengths

- **Simple, readable code:** The importer is easy to understand and trace, with clear intent in the CSV parsing logic.
- **No external dependencies:** Minimizes supply chain risk and simplifies deployment.
- **Graceful row-level error handling:** The logic to skip invalid rows (`if len(row) < 3 || row[1] == ""`) prevents a single malformed row from stopping the entire import.

### Key Risks

**The subscriber import tool is completely non-functional for its stated purpose.** All imported data is lost when the program exits, which directly explains the partner's report of missing subscribers. The operator receives a success message and forwards it to the partner, creating false confidence.

1. **Data loss on exit** (#1): The entire store vanishes on program termination. No persistence mechanism exists.
2. **Silent failures** (#2): Errors in file I/O and CSV parsing are ignored, preventing the operator from knowing the import failed.
3. **False success reporting** (#3): The program reports success regardless of whether data was actually saved, misleading the operator and partner.
4. **Unsafe repeats** (#4): The runbook claims imports are "safe to repeat," but the code will overwrite existing records without warning.
5. **Invalid email acceptance** (#5): No email validation allows garbage data into the system.

### Priority Order

1. **Add persistence (Finding #1)** — Critical blocker. Without durable storage, the importer cannot fulfill its function. Implement database writes or file-based storage before any other fix.
2. **Add error handling (Finding #2)** — Critical blocker. Errors must be caught and reported so failures are visible.
3. **Verify persistence before reporting success (Finding #3)** — Depends on #1 and #2. After data is written, confirm it was saved before printing success.
4. **Implement duplicate detection (Finding #4)** — High priority. Prevents data corruption from repeated imports.
5. **Add email validation (Finding #5)** — High priority. Prevents invalid email addresses from corrupting the dataset.

### Coverage Gaps

- **Integration environment:** Not examined — no database configuration, schema, or connection details were found. The persistent storage target is undefined.
- **Deployment and infrastructure:** No CI/CD pipelines, deployment scripts, or infrastructure-as-code checked.
- **Operational procedures:** Only the brief runbook was reviewed; actual operator workflows and error-handling procedures in production are unknown.
- **Data schema and validation rules:** No specification of which fields are required, which are optional, or what formats are expected beyond email and plan fields.
- **Audit and logging:** No audit trail, logging, or monitoring of imports was found.
- **Testing:** No unit or integration tests exist to verify import correctness or persistence.
- **Recovery and rollback:** No mechanism to detect, correct, or roll back failed imports.

---

## Verification

I confirmed by inspecting the codebase:
- The in-memory `items` map in `internal/store/store.go` is the only data store, with no database connections, file I/O, or external persistence.
- File open and CSV parsing errors in `cmd/importer/main.go` are discarded without logging.
- The success message is printed unconditionally regardless of whether data was persisted.
- Email validation is limited to non-empty checks; no format validation occurs.
