# Releasing the ledger API

Merging to `main` tests, builds, and rolls the new image out to every pod.

## This release: Fee rounding change

**Decision:** Move fee rounding from per-line to once on invoice total.

**Rationale:** Finance team requested this approach to match their internal
accounting model. Mathematically cleaner: avoids cumulative rounding error from
multiple line-level round operations.

**Risk:** Financial reconciliation mismatch. Unlike a crash, this will not
break invoicing. Customers will be charged and invoices generated. However,
reconciliation against payment processor will show discrepancies the next
morning if the calculation is wrong.

**Verification:** Finance approved on 2026-08-31. Spot-checked against 
sample invoices; deltas ranged from -2¢ to +1¢ per invoice, all acceptable.

---

## Deployment strategy

1. **Test coverage:** Unit tests pass before any deployment.
2. **Single merge to main:** One commit, no separate staging. GitHub Actions
   builds and deploys automatically.
3. **Gradual visibility:** Invoices generated throughout the day. Reconciliation
   discrepancies surface during end-of-day accounting (next morning at earliest).

---

## Monitoring and verification

**What to watch:**
- Invoice volumes normal (no crashes or errors)
- No customer complaints about charges (morning after)
- Reconciliation report from finance (due morning after release)

**Morning-after checklist:**
1. Finance runs their reconciliation against payment processor
2. If matched → release is good, lock in code
3. If mismatched → proceed immediately to rollback (see below)

---

## Rollback procedures

### Immediate rollback (if reconciliation fails)

**Option A: Image rollback (fastest, ~30 seconds)**

Reverts both code AND fee calculation in one step:

```bash
kubectl --context production rollout undo deployment/ledger-api
```

This rolls back the entire previous image. Does not restore data written while
the current image was live (invoices already generated keep their fees).

**Option B: Code rollback (if only fee logic needs to revert)**

Edit `src/pricing.js` and change the default export. Old calculation preserved as
`feeMinorOld()`:

```javascript
// Swap which function is exported
export default feeMinorOld;  // Revert to per-line rounding
```

Then rebuild and deploy:

```bash
git commit -am "Revert fee rounding to per-line"
git push origin main
```

Deployment will trigger automatically. About 2 minutes to build and roll out.

**Use Option A if:** You need to revert immediately (don't have time to wait for build)

**Use Option B if:** You want to preserve the image but only flip the fee logic

### Post-rollback

- Finance re-runs reconciliation with the old calculation
- Any invoices generated during the broken period remain with their original fees
  (they do not re-calculate)

---

## Decision log

- **When:** 2026-08-31
- **Decision:** Merge and deploy on 2026-09-01
- **Approval:** Finance team signed off on new numbers
- **Rollback:** Preserved old calculation (`feeMinorOld`) in code for quick revert
- **Owner:** Release orchestrated by CI/CD pipeline on push to main
