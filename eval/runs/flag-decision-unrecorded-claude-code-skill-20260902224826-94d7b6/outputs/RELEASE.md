# Release Process

## Feature Flags

Feature flags decouple code deployment from behavior release. A flag allows bad code to be turned off in seconds without a rollback or redeploy. However, each flag has its own cost — an unremoved flag becomes permanent branching nobody dares delete.

### Flag Lifecycle

1. **Add flag for high-risk changes only.** Not every change needs a flag. A flag is justified when:
   - The change is large or high-risk enough that turning it off matters more than the code review cost
   - You can articulate a concrete scenario where the flag would be flipped during an incident
   - The cost of leaving the flag permanently is acceptable (it becomes production branching)

2. **Record the decision.** When adding or removing a flag:
   - **PR title or body** must explicitly state `Flagged: yes — <flag_name>: <what it gates>` or `Flagged: no`
   - **Removal condition** must be documented in `src/flags.js` at the same time the flag is added
   - A removal condition that says "never remove this" means the flag should be deleted now and its behavior inlined

3. **Remove the flag.** When the removal condition is met:
   - Inline the flagged behavior by making the new behavior permanent
   - Delete the flag definition from `src/flags.js`
   - Delete all conditional logic that checks the flag
   - The commit message should reference which flag was removed and why

### Current Flags

See `src/flags.js` for all flag definitions. Each flag lists:
- What behavior it gates
- Its removal condition
- The PR and date it was added (if available)

Flags that are permanently on for more than 12 months should be audited quarterly — either a removal date should be set, or the business case for keeping it should be documented.

## Rollback

Before any release:
1. Identify which flags guard the change
2. Verify the rollback path (typically: flip the flag, redeploy config, wait for smoke tests)
3. Write the rollback command in the incident runbook so it can be executed without debate at 3am

Example: if `newLedgerWriter: true` guards your change, document: `Set newLedgerWriter to false in src/flags.js, push config deploy.`
