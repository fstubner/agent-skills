# Feature Flags

This document records all feature flags, the changes they gated, and removal conditions.

## Flag: `newLedgerWriter`

**Status:** ON (enabled)

**Purpose:** Unknown — requires investigation. Based on naming, likely gates a new ledger writing implementation.

**Changes shipped behind flag:** Unknown — no PR record found.

**Removal condition:** Remove after:
1. Production telemetry confirms the new implementation is working without incidents for 30 days
2. Load testing validates performance parity with legacy implementation
3. All integration points have been verified in production

**Last verified:** 2026-09-02

---

## Flag: `batchedExports`

**Status:** ON (enabled)

**Purpose:** Unknown — requires investigation. Based on naming, likely gates batching of export operations.

**Changes shipped behind flag:** Unknown — no PR record found.

**Removal condition:** Remove after:
1. Batch export latency and memory usage are validated in production for 30 days
2. No data integrity issues are detected
3. Customer migration to batched exports is complete

**Last verified:** 2026-09-02

---

## Flag: `fastEntryLookup`

**Status:** ON (enabled)

**Purpose:** Unknown — requires investigation. Based on naming, likely gates an optimized entry lookup implementation.

**Changes shipped behind flag:** Unknown — no PR record found.

**Removal condition:** Remove after:
1. Query performance improvements are validated in production for 30 days
2. No missing entries or stale data issues are detected
3. Read latency SLA is consistently met with faster implementation

**Last verified:** 2026-09-02

---

## Flag: `reconciliationV2`

**Status:** ON (enabled)

**Purpose:** Unknown — requires investigation. Based on naming, likely gates version 2 of reconciliation logic.

**Changes shipped behind flag:** Unknown — no PR record found.

**Removal condition:** Remove after:
1. Reconciliation accuracy is validated in production for 30 days with 100% pass rate
2. No discrepancies detected vs legacy reconciliation
3. Performance meets SLA requirements

**Last verified:** 2026-09-02

---

## Flag: `legacyCurrencyRounding`

**Status:** OFF (disabled) — Turned off during an incident.

**Purpose:** Gates legacy currency rounding logic.

**Changes shipped behind flag:** Unknown — no PR record found. Flag was disabled as an incident mitigation.

**Removal condition:** Can be safely deleted after:
1. Incident post-mortem confirms the new rounding logic is correct
2. Production has been stable with new logic for 90 days
3. All affected customers have been validated

**Last verified:** 2026-09-02

---

## Process for future flags

Going forward, every PR that ships behavior changes must record whether it used a flag:

- **Flagged: Yes** — Reason for flag (e.g., "breaking change, needs gradual rollout")
- **Flagged: No** — Reason flag not needed (e.g., "internal refactor, no user-facing change")

See `.github/pull_request_template.md` for the required field.

When adding a new flag:
1. Document it in this file immediately
2. State the removal condition at the time the flag goes in, not when you want to remove it
3. Include what specific changes are gated by the flag
