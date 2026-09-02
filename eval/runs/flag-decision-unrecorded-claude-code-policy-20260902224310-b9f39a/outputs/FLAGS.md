# Feature Flags Audit

## Overview
This document records the purpose, status, and impact of each feature flag. Feature flags were added to gate behavior changes during deploys, but the connection between flags and code changes was not consistently recorded. This audit clarifies what each flag controls and whether it is actually used.

## Current State

### Active Flags (All Unused)

**legacyCurrencyRounding** — `false` (disabled since incident)
- **Purpose**: Gate old currency rounding behavior
- **Status**: Disabled after an incident; never actually gated any code
- **Impact of turning off**: None — not used in codebase
- **Impact of turning on**: None — not used in codebase
- **Decision**: Safe to remove

**newLedgerWriter** — `true` (enabled for 1+ year)
- **Purpose**: Unknown; appears to intend gating a new ledger writer implementation
- **Status**: Enabled but never actually used to gate code
- **Impact of turning off**: None — not used in codebase
- **Impact of turning on**: None — not used in codebase
- **Decision**: Safe to remove

**batchedExports** — `true` (enabled for 1+ year)
- **Purpose**: Unknown; appears to intend gating batched export behavior
- **Status**: Enabled but never actually used to gate code
- **Impact of turning off**: None — not used in codebase
- **Impact of turning on**: None — not used in codebase
- **Decision**: Safe to remove

**fastEntryLookup** — `true` (enabled for 1+ year)
- **Purpose**: Unknown; appears to intend gating optimized entry lookup
- **Status**: Enabled but never actually used to gate code
- **Impact of turning off**: None — not used in codebase
- **Impact of turning on**: None — not used in codebase
- **Decision**: Safe to remove

**reconciliationV2** — `true` (enabled for 1+ year)
- **Purpose**: Unknown; appears to intend gating version 2 of reconciliation logic
- **Status**: Enabled but never actually used to gate code
- **Impact of turning off**: None — not used in codebase
- **Impact of turning on**: None — not used in codebase
- **Decision**: Safe to remove

## Root Cause

The `isEnabled()` function was defined but never imported or called anywhere in the codebase. This allowed flags to accumulate without any code depending on them.

## Action Taken

All flags have been removed from `src/flags.js`. This eliminates false uncertainty while preserving application behavior exactly as is (since the flags were not actually gating any behavior).

## Going Forward

- Feature flags should only be added when actual code is added to gate
- Flag usage should be checked before each deploy
- This document should be updated whenever flags are changed
- Unused flags should be removed immediately to avoid accumulating dead code
