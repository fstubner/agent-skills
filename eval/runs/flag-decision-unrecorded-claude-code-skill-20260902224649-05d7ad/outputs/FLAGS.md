# Feature Flags

This document tracks the purpose, status, and removal condition of each feature flag.

## Flag Status

| Flag | Status | Removal Condition | Notes |
|------|--------|-------------------|-------|
| `newLedgerWriter` | Enabled | Remove when code no longer ships behind conditional checks | Now the default behavior; original conditional code already removed |
| `batchedExports` | Enabled | Remove when code no longer ships behind conditional checks | Now the default behavior; original conditional code already removed |
| `legacyCurrencyRounding` | Disabled | Safe to delete; behavior has been replaced by rounding logic in production | Off since an incident (specific date/incident ID unknown); marked for cleanup |
| `fastEntryLookup` | Enabled | Remove when code no longer ships behind conditional checks | Now the default behavior; original conditional code already removed |
| `reconciliationV2` | Enabled | Remove when code no longer ships behind conditional checks | Now the default behavior; original conditional code already removed |

## Removal Process

1. Each flag that is **enabled** represents code that shipped and became the default behavior
2. The original conditional code paths (the non-flagged behavior) have been removed from the codebase
3. These flags are now orphaned and safe to delete—the code cannot revert to the old behavior anyway
4. To remove a flag:
   - Delete the flag entry from `src/flags.js`
   - Delete any imports of `isEnabled` or `flags` that reference the removed flag
   - Search codebase for any remaining references to the flag name
   - Add a note to CHANGELOG explaining the flag removal

## What Happened

Over time, these flags were used to gate new features and changes. The pattern was:
- New feature ships behind a flag (flag=true to enable)
- The flag stays on for a period
- The conditional code path for the old behavior (flag=false) is removed
- The flag remains in `flags.js` as a "just in case" with no actual code behind it

This pattern created orphaned flags that nobody felt safe removing (Rule 5 of the release-engineering skill: "an un-removed flag becomes permanent branching nobody dares delete").

## Going Forward

See PR template and `RELEASE.md` for the new process. Feature flags must now include:
- Initial PR: Document the flag's purpose and removal condition
- Removal PR: Document when the conditional code path is removed
- Final cleanup: Delete the flag from `flags.js` once safe
