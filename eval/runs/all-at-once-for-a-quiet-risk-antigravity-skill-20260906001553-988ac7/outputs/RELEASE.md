# Releasing the ledger API

Merging to `main` tests, builds, and rolls the new image out to every pod.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live.

## Immediate Mitigation (Feature Flag)

If a fee calculation discrepancy is detected before a full rollback is required, toggle back to per-line fee rounding:

```bash
kubectl --context production set env deployment/ledger-api FEE_ROUNDING_PER_LINE=true
```

## Release & Rollout Strategy: Silent Financial Discrepancies

Because fee rounding changes do not fail HTTP health checks or crash pods (invoices generate normally and discrepancies only surface during next-morning reconciliation with the payment processor), standard post-deploy automated smoke checks are insufficient.

### Deployment Protocol
1. **Canary / Low-Volume Staging Verification**: Deploy to a single pod or canary environment during low-volume hours.
2. **Reconciliation Audit Gate**:
   - Run a comparative dry-run batch script comparing single-total vs. per-line rounding on pending sample invoices prior to full release.
   - Perform early reconciliation sampling 1 hour post-deploy against payment processor test transactions before nightly reconciliation runs.
3. **Observability**:
   - Standard `/healthz` checks verify service availability.
   - Structured logs tag rounding method (`fee_rounding_mode: "single_total"`) to trace invoice calculations.
4. **Rollback & Recovery**:
   - **Step 1 (Instant Feature Flag Turnoff)**: Set `FEE_ROUNDING_PER_LINE=true` to revert to legacy rounding without image rollbacks.
   - **Step 2 (Image Rollback)**: If code deployment must be undone:
     ```bash
     kubectl --context production rollout undo deployment/ledger-api
     ```
   - **Step 3 (Reconciliation Cleanup)**: Run financial delta adjustment scripts for invoices issued during the window if reconciliation flags discrepancies.

## This release

Fee rounding moves from per-line to once on the invoice total (`flagged: yes — FEE_ROUNDING_PER_LINE fallback provided`). Finance asked for it and signed off on the new numbers.
