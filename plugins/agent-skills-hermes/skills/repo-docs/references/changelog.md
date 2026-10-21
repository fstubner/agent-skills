# CHANGELOG entries

The CHANGELOG is the full record of what changed and why, and it's the
source the release notes are written from.

## Where entries go

New work goes under `## [Unreleased]` at the top. It stays there until a
release, when the heading becomes `## <version> — <date>` and a new empty
`[Unreleased]` goes above it. The checker reads only the `[Unreleased]`
section, because released entries are history and are not rewritten.

## Shape of an entry

Group by theme, not by commit. Each entry is one paragraph.

```markdown
**The weekly standards drift job is green again.** Every scheduled run had
failed since 2026-09-07. Antigravity moved its plugin page with an HTML
meta-refresh, which the check read as an empty page, and it now reports
where a page moved.
```

1. **A bold first sentence stating the outcome** for someone who uses the
   project. "Search now finds partial matches", not "Refactored the query
   builder".
2. **What was wrong, if it was a fix.** One or two sentences. Dates belong
   here, since a CHANGELOG is a dated record.
3. **The figures that support it**, when there are any. These are what the
   release notes may later quote.

## Rules

- One theme per entry. Two unrelated changes are two entries.
- Name the user-facing effect before the mechanism.
- Every number in an entry must be one you measured.
- An entry that turns out wrong gets a dated correction under it. The
  original wording stays, since readers already saw it.
