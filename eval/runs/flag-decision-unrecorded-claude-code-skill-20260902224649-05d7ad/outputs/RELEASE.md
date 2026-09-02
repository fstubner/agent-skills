# Release Process

## Deployments

Code is deployed via commit to `main`. Each commit is promoted through staging to production without rebuilding.

## Feature Flags

All PRs that introduce feature flags must include in the description:

```
flagged: yes — <reason>
  - Removal condition: (when is it safe to delete this flag?)
  - Estimated time on: (how long should this ship behind a flag?)
```

Or if no flag is used:

```
flagged: no
```

This ensures every flag has a documented removal condition before it ships.

## Orphaned Flags

Currently, 5 feature flags exist in `src/flags.js` that are **no longer used in the codebase**:

- `newLedgerWriter`
- `batchedExports`
- `legacyCurrencyRounding`
- `fastEntryLookup`
- `reconciliationV2`

The changes behind these flags were deployed and became the default behavior. The conditional code paths for the non-flagged behavior were then removed. The flags themselves were not deleted.

**Why they persist:** Rule 5 of release-engineering skill: "an un-removed flag becomes permanent branching nobody dares delete." Without documentation of what each flag controls, nobody felt safe removing them.

### Removal Strategy

These flags are safe to remove because:

1. The code cannot revert to the old behavior (the old code paths have been deleted)
2. They are not referenced by any conditional logic in the codebase
3. Toggling them in production would have no effect

To remove orphaned flags:
1. Verify no code references the flag name (grep the codebase)
2. Delete the flag from `src/flags.js`
3. Create a PR with the change
4. Add a note to the changelog: "Removed orphaned feature flag: {flagname} (dead code, no longer used)"

Flags should be removed in small batches to keep PRs focused and easy to review.

See `FLAGS.md` for detailed history of each flag.

## Rollback

If a release causes issues:

1. **For regular changes:** Revert the commit and redeploy. Example: `git revert <commit> && git push`
2. **For feature flagged changes:** If the flag is still active in the code, flip the flag to false in `src/flags.js` and redeploy. This takes ~5 minutes and requires no git operation.

If an orphaned flag were somehow toggled (which would have no effect), reverting the commit is the only option since the old code no longer exists.
