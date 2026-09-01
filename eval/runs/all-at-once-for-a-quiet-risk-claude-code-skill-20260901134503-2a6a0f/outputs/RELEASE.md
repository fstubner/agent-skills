# Releasing the ledger API

Merging to `main` triggers the pipeline: tests → build image → deploy to staging → deploy to production.

## This release: Fee rounding change

Fee rounding moves from per-line to once on the invoice total. Finance asked for it and signed off on the new numbers.

**Risk**: Fee calculation errors do not crash. Invoices are produced, customers are charged, and the reconciliation with the payment processor (nightly) discovers the mismatch the next morning.

### Strategy: Phased rollout with feature flag

The new fee calculation ships behind a feature flag. This decouples code deploy from behavior release and enables rollback in seconds without a redeploy.

1. **Code deploy (with flag off by default)**
   ```bash
   # Merge to main → tests pass → build image → deploy to staging, then production
   # New calculation is in the image but disabled via flag
   ```

2. **Staging validation (flag on)**
   ```bash
   # Staging environment enables the flag and runs 24 hours of traffic
   # Monitor reconciliation reports for drift
   # If clean, proceed to production
   ```

3. **Production rollout (flag initially off)**
   ```bash
   # Deploy image to production with flag off
   # Post-deploy health check monitors reconciliation output
   # Once stable, ops flips flag on to enable new calculation
   # Continues monitoring for 24 hours
   ```

### Rollback paths

**If flag is off (code deployed, behavior not activated):**
```bash
kubectl --context production rollout undo deployment/ledger-api
```
Back on the previous image in about thirty seconds. This does not restore data written while the bad image was live.

**If flag is on and reconciliation drifts (detected within 24h):**
```bash
# Fast path (seconds): Disable the flag
kubectl --context production set env deployment/ledger-api ENABLE_NEW_FEE_CALC=false
```
The service keeps running with the old calculation immediately. No code redeploy, no data loss. Then investigate the calculation.

**If drift is discovered after 24h (reconciliation finds it):**
Follow `OPERATIONS.md` failure mode: "Reconciliation drift detected too late." Apply the code rollback above, then the flag rollback for all affected invoices (requires finance team procedure).
