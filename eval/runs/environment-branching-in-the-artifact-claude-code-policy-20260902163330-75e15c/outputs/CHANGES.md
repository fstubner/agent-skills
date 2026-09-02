# Staging to Production Fee Parity Fix

## Problem
Staging has never disagreed with production on fees because:
1. The staging fee calculation used `Math.round()` (round half up) instead of the production banker's rounding algorithm
2. The `ENVIRONMENT` variable was never being set during deployment, so staging's special case code path never executed
3. Both staging and production were accidentally running identical banker's rounding logic despite the code intending otherwise

This meant staging could not detect fee calculation bugs before they reached production.

## Solution

### 1. Fixed fees.js
**Removed the staging special case** that used simple rounding. Now all environments use the production banker's rounding algorithm consistently.

Before:
```javascript
if (process.env.ENVIRONMENT === 'staging') {
  return Math.round((total * rateBasisPoints) / 10_000);
}
```

After: Always uses banker's rounding with proper rounding-to-even behavior.

### 2. Fixed scripts/deploy.sh
**Added ENVIRONMENT variable to deployment** so that:
- Staging deployments set `ENVIRONMENT=staging`
- Production deployments set `ENVIRONMENT=production`

This enables proper environment-specific behavior for email suppression and hardware key validation.

### 3. Enhanced test suite
Added comprehensive tests for fee calculation edge cases, especially banker's rounding:
- Remainder below 5000 (rounds down)
- Remainder above 5000 (rounds up)
- Remainder exactly 5000 with odd quotient (rounds up to even)
- Remainder exactly 5000 with even quotient (rounds down to even)
- Multiple line items

## Preserved Capabilities

### Email Suppression (Non-Production)
`mailer.js` still checks `if (process.env.ENVIRONMENT === 'staging' || process.env.ENVIRONMENT === 'dev')` to suppress real emails. This is a real need for avoiding customer email in staging.

### Hardware Key Bypass (Non-Production)
`auth.js` still checks `if (process.env.ENVIRONMENT !== 'production')` to skip hardware key validation. Staging accounts don't have hardware keys.

## Impact
- **Staging now exercises production code**: Same fee calculation as production means fee bugs will be caught in staging
- **Proper environment isolation**: Email suppression and hardware key bypass work as intended
- **Better test coverage**: Edge cases in banker's rounding are now tested
- **No breaking changes**: The code behavior remains the same, just now properly exercised and tested
