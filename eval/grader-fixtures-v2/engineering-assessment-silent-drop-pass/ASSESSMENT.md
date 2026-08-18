# Subscriber importer — engineering assessment

The partner's report is consistent with the code: this tool can drop
subscribers and still print a success line. Five findings, ranked by how much
data each can lose. Severity is my judgement; unconfirmed items are marked.

## 1. Critical — file and parse errors are discarded (`cmd/importer/main.go:12`)

`file, _ := os.Open(...)` and `rows, _ := csv.NewReader(file).ReadAll()` both
throw the error away with the blank identifier. A missing, unreadable or
malformed CSV produces an empty row set, and the program continues to the
summary line as if it had worked. Recommendation: return the error, fail
loudly with a non-zero exit, and never print a count for an import that did
not read its input.

## 2. Critical — skipped rows are invisible (`cmd/importer/main.go:18`)

Rows with fewer than three fields or an empty email hit `continue` with no
log, no counter and no per-row detail. `README.md` states failing rows are
"skipped so one bad row cannot fail a whole import" and that every import is
"reported to the partner with a row count" — but the printed count cannot
distinguish a clean import from one that silently discarded half the file.
That is exactly the symptom the partner reported. Recommendation: count and
log every skipped row with its line number and reason, and surface the skip
total in the confirmation.

## 3. High — duplicate emails overwrite subscribers (`internal/store/store.go:18`)

`items[s.Email] = s` overwrites by key, so a second row for an existing email
silently replaces that subscriber's plan. The runbook says imports are "safe
to repeat", which makes an accidental re-run a plan-mangling operation rather
than a no-op. Recommendation: treat an existing email as a conflict —
upsert deliberately or reject with a clear error — and record which rows
changed an existing record.

## 4. High — there are no tests at all

No test file exists anywhere in the module: no `main_test.go`, no
`store_test.go`, nothing under `internal/`. Every behaviour above is
unverified, and a regression in any of them is undetectable before an
operator hits it. Recommendation: add table-driven tests over CSV inputs
covering a missing file, a malformed row, an empty email and a duplicate
email.

## 5. Medium — the documentation asserts properties the code lacks

`README.md` and `docs/runbook.md` both describe safety the implementation
does not provide (reporting of failures, safe repetition). Documentation that
states an untrue invariant is worse than silence, because it stops anyone
checking. Recommendation: correct both to describe actual behaviour, and
re-issue after fixing findings 1 to 3.

## What I ran

```
$ go vet ./...
go: no such tool "vet"; go toolchain not available in this workspace
```

The toolchain is not installed here, so the code was reviewed by reading and
not by building. That is a limitation of this assessment, not evidence that
it compiles.

## Not examined

- The partner's actual CSV — no sample data available, so the real
  distribution of malformed rows is unconfirmed.
- The production import and the operator's workflow — no access, so how
  often re-runs happen is an assumption drawn from the runbook.
- Any persistence behind `store` — the in-memory map is all that exists in
  this workspace; whether production writes elsewhere could not be verified.
