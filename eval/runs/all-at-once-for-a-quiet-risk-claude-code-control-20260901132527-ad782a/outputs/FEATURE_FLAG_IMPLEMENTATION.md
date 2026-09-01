# Feature Flag Implementation: Fee Rounding

This document provides the concrete implementation pattern for controlling the fee rounding change during rollout.

## Pattern

Use environment variable + account-level feature flag to control which fee calculation is active:

```javascript
// Example usage in invoice generation:
import { feeMinor, feeMinorLegacy } from './pricing.js';

function calculateInvoiceFee(accountId, lineTotalsMinor, rateBasisPoints) {
  const useNewRounding = shouldUseNewFeeRounding(accountId);
  
  if (useNewRounding) {
    return feeMinor(lineTotalsMinor, rateBasisPoints);
  } else {
    return feeMinorLegacy(lineTotalsMinor, rateBasisPoints);
  }
}

function shouldUseNewFeeRounding(accountId) {
  // Check environment flag (for emergency disable)
  if (process.env.DISABLE_NEW_FEE_ROUNDING === 'true') {
    return false;
  }
  
  // Check account-level flag (for gradual rollout)
  return isAccountInFeeRoundingBeta(accountId);
}

async function isAccountInFeeRoundingBeta(accountId) {
  // Query feature flag service (example pseudocode)
  const flags = await featureFlagClient.getFlags(accountId);
  return flags.feeRoundingV2 === true;
}
```

## Rollout Phases

### Phase 1: Canary (Day 1)
```bash
# Enable for test/staging accounts only
DISABLE_NEW_FEE_ROUNDING=false
# Feature flag service has: test-account-123 → feeRoundingV2: true
```

### Phase 2a: 10% of Production (Day 2)
```bash
# Enable for production but limited set
DISABLE_NEW_FEE_ROUNDING=false
# Feature flag service: 10% of accounts → feeRoundingV2: true
```

### Phase 2b: 25% (Day 4)
```bash
# Expand to 25% after validation
# Feature flag service: 25% of accounts → feeRoundingV2: true
```

### Phase 3: 100% (Day 8)
```bash
# All accounts on new behavior
# Feature flag service: 100% of accounts → feeRoundingV2: true
# OR remove feature flag check entirely and delete legacy code
```

## Emergency Rollback

**If issues detected at any phase:**

```bash
# Option 1: Disable via environment (immediate, all accounts)
DISABLE_NEW_FEE_ROUNDING=true
# Deploy (takes 2-5 minutes)
# All invoices revert to legacy calculation

# Option 2: Disable via feature flag service (targeted)
# Set affected account(s): feeRoundingV2: false
# Takes effect on next invoice generation
```

## Testing Checklist

Before each phase:

- [ ] Compare 100+ invoices: legacy vs new rounding
- [ ] Verify: max delta per invoice is < 1 cent
- [ ] Verify: total variance across batch is < 0.1% of invoice value
- [ ] Finance team validates sample invoices manually
- [ ] No customer disputes in support queue

## Data Preservation

Both functions are preserved in the codebase indefinitely:
- `feeMinor()` — current production calculation
- `feeMinorLegacy()` — fallback for rollback

This allows:
- Re-running historical invoices with legacy calculation if needed
- Audit trails comparing both algorithms
- Future removal without emergency pressure
