# Architecture Decision Record: Fee Rounding Method

Date: 2026-09-01
Status: PROPOSED (pending deployment)

## Context
The finance team identified that per-line fee rounding creates reconciliation mismatches with payment processors, which reconcile fees on the total invoice amount. Invoices produced locally differ from the payment processor's records, complicating accounting.

## Problem
- Current system rounds fees on each line item, then sums them
- Payment processor rounds fees on the total invoice amount
- Difference accumulates with more line items per invoice
- Reconciliation reports show a discrepancy every morning
- No operational impact (invoices still produced, customers charged) but accounting is broken

## Decision
Implement two parallel fee-calculation methods:
1. **New (active default)**: Sum all line amounts, round once on total
2. **Old**: Keep original per-line rounding for instant rollback

Switch between them via environment variable `PRICING_ROUNDING_VERSION`.

## Rationale
1. **Safety First**: Keeps working rollback path with zero deployment latency
   - If new rounding has a systematic bias or bug, switch via env var in 2 minutes
   - No code deploy, restart, or schema migration required for rollback
   
2. **Matches Finance Requirements**: New method reconciles with payment processor
   - Aligns internal calculation with external system
   - Satisfies accounting requirements
   
3. **Testable Approach**: Both implementations present, behavior differences documented
   - Test suite demonstrates when old and new rounding diverge
   - Validates edge cases before deployment
   
4. **Additive, Backwards-Compatible**: Old code stays in codebase
   - No removal of working logic
   - Historical context preserved
   - Clear deprecation path

## Implementation
- `feeMinorNewRounding()`: Total rounding (formula: `round(total × rate / 10000)`)
- `feeMinorOldRounding()`: Per-line rounding (formula: `sum(round(line × rate / 10000))`)
- `feeMinor()`: Router function that picks implementation based on env var

## Testing
Tests verify:
- Each implementation behaves independently
- Edge cases where rounding differs (e.g., five lines at 333 minor units each)
- New rounding is default when env var unset
- Old rounding available when PRICING_ROUNDING_VERSION=old

## Deployment
- Deploy with PRICING_ROUNDING_VERSION="new" (or unset, same effect)
- Monitor reconciliation reports for 48 hours
- If issues found, set PRICING_ROUNDING_VERSION="old" and restart service
- No code change or downtime required for rollback

## Risks Mitigated
- Silent reconciliation failures: Monitored for 48 hours post-deployment
- Unknown rounding bias: Tests and finance validation before go-live
- Inability to rollback: Instant env-var switch available

## Remaining Uncertainty
- Finance team must validate 30+ days of historical invoices re-calculated with new method
- Actual impact only known after payment processor comparison
- No hedging against potential systematic bias in new method (mitigated by tests and 48-hour monitoring window)
