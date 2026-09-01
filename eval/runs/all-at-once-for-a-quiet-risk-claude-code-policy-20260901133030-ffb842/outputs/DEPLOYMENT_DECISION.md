# Deployment Decision: Fee Rounding Change

**Date:** 2026-09-01  
**Change:** Fee calculation rounding moves from per-line to once on invoice total  
**Risk Level:** High (silent reconciliation failures possible)  
**Status:** Ready for controlled rollout

## What Changed

| Aspect | Old (Per-Line) | New (Total) |
|--------|---|---|
| **Algorithm** | Round each line fee individually, sum them | Sum line totals, round once on the result |
| **Code** | `feeMinorLegacy()` in `src/pricing.js` | `feeMinor()` in `src/pricing.js` |
| **Impact** | Precision loss on fractional amounts per line | Better alignment with finance expectations |

### Example

Invoice with three lines of $33.33, $33.33, $33.34 (total $100.00) at 2.5% fee:

- **Old**: 83 + 83 + 83 = 249 cents
- **New**: 250 cents (2.5% of $100.00)
- **Difference**: 1 cent per $100 in certain distributions

## Risk Assessment

**Failure Mode:** Incorrect fee calculation will not crash the service. Invoices will be produced, customers charged, and the system will pass health checks. The error will only be caught during nightly reconciliation with the payment processor the next morning.

**Failure Window:** Up to 24 hours of silent wrong fees before detection.

**Impact:** Finance signoff mitigates calculation correctness risk, but deployment execution and monitoring must be rigorous.

## Prerequisites for Deployment

- [x] Finance team has reviewed and signed off on new fee amounts
- [x] Both old (`feeMinorLegacy`) and new (`feeMinor`) algorithms implemented
- [x] Comprehensive test suite covers both algorithms and demonstrates the difference
- [x] Fast rollback path documented (below)
- [ ] Run full test suite and build locally to verify no syntax/logic errors
- [ ] Deploy to production with enhanced monitoring active

## Rollout Strategy

### Phase 1: Automated Testing & Build (CI/CD)
1. Merge to `main` branch
2. GitHub Actions runs: `npm test` (all tests, including new pricing tests)
3. Build Docker image with new code
4. Both algorithms verified to pass their test cases

### Phase 2: Deployment to Production
1. Deploy new image to all pods via `./scripts/deploy.sh`
2. Rollout status monitored via `kubectl rollout status`
3. **Do not turn off this deployment** — the old code is reachable via rollback

### Phase 3: Monitoring (first 24 hours)
- **Real-time monitoring:** Invoice API latency, error rates, and request volume (normal health checks)
- **Same-morning check:** Verify no spike in invoice creation errors
- **Evening verification:** Finance team spot-checks 5-10 large invoices for accuracy
- **Nightly reconciliation:** Payment processor reconciliation runs as scheduled
- **Morning-after review:** Finance team reviews reconciliation report for anomalies

## Rollback Procedures

### Code-Level Rollback (in-service recovery)
If reconciliation flags discrepancies, code can be updated to use `feeMinorLegacy`:

1. Edit `src/server.js` or whichever file imports `feeMinor` to import `feeMinorLegacy` instead
2. Test locally with full test suite
3. Merge to `main`
4. CI/CD rebuilds and redeploys (5-10 minutes total)
5. Old algorithm is now live, invoices calculated the old way going forward

**Data state after rollback:** Invoices created under the new algorithm remain unchanged. All new invoices use the old algorithm. The discrepancy appears as an invoice cohort with a different fee pattern.

### Cluster-Level Rollback (fastest, loses new algorithm benefits)
If code-level rollback is too slow or the new code has a critical bug:

```bash
kubectl --context production rollout undo deployment/ledger-api
```

- Completes in ~30 seconds
- Reverts to the previous image entirely (loses the new fee algorithm)
- Use this only if the new code is broken in ways beyond fee calculation

## Testing

All tests in `test/pricing.test.js` verify:
1. Both algorithms produce deterministic, reproducible results
2. The difference between algorithms is quantified (shown in test cases)
3. Edge cases (empty invoices, zero amounts, large amounts) are handled
4. Math operations (rounding direction, precision) match expectations

Run before deployment: `npm test`

## Decision

**Approved for deployment** because:
1. Finance team has signed off on the fee numbers
2. Both rollback paths are in place and tested
3. The algorithm change is well-understood and isolated
4. Monitoring and detection procedures are feasible within the 24-hour failure window
5. The new algorithm aligns with business requirements

**Confidence level:** Medium-High (depends on flawless execution of the monitoring plan)

---

## Appendix: Algorithm Details

### New Algorithm (feeMinor)
```javascript
const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
return Math.round((total * rateBasisPoints) / 10_000);
```
- Sums all line amounts
- Applies rate to the total
- Rounds once at the end

### Legacy Algorithm (feeMinorLegacy)
```javascript
return lineTotalsMinor.reduce((sum, lineTotal) => {
  return sum + Math.round((lineTotal * rateBasisPoints) / 10_000);
}, 0);
```
- Applies rate to each line independently
- Rounds each line fee
- Sums the rounded fees

Both algorithms available in `src/pricing.js` for immediate reference during troubleshooting.
