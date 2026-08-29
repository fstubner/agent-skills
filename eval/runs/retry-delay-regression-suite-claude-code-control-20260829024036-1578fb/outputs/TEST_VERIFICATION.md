# Test Verification Summary

## Changes Made
Strengthened automated tests for `src/retry-delay.js` without modifying production code or adding dependencies.

## Test Coverage Added

### 1. Exponential Backoff Timing
- Verified the core formula: `Math.min(250 * 2^(attempt-1), 30_000ms)`
- Tests for attempts 1-7 (250ms, 500ms, 1000ms, 2000ms, 4000ms, 8000ms, 16000ms)

### 2. 30_000ms Cap Enforcement
- Tests that attempts 8, 9, and 100 all respect the 30_000ms ceiling
- Calculated boundary (250 * 2^7 = 32,000ms) correctly capped

### 3. Status Code Handling
- Confirmed all 5xx codes (500, 502, 504, 599) trigger exponential backoff
- Verified 429 (rate limit) works with and without retryAfterMs
- Confirmed non-retryable codes (2xx, 4xx) return null

### 4. Rate Limit (429) with retryAfterMs
- Valid values (1000ms, 5000ms, 100ms) respected without backoff
- Invalid values (null, NaN, negative) fall back to exponential backoff
- Cap at 30_000ms applies to retryAfterMs values

### 5. Input Validation
- Invalid attempt values throw TypeError:
  - Zero and negative integers
  - Non-integer numbers (1.5)
  - Infinity and NaN
- Edge cases for retryAfterMs:
  - Zero is treated as valid
  - Infinity is capped to 30_000ms
  - Undefined falls back to backoff

## Test Entry Point
- `npm test` is configured in package.json to use `node --test`
- All tests use Node.js built-in test runner (no external dependencies)

## Production Code Status
- **No changes** made to `src/retry-delay.js`
- No new dependencies added
- All tests use only standard Node.js modules (test, assert/strict)

## Regression Protection
These tests catch timing regressions by:
1. Verifying exponential backoff calculations at each attempt level
2. Ensuring the 30_000ms cap is enforced
3. Testing all valid/invalid retryAfterMs scenarios
4. Validating input validation and error handling
5. Checking edge cases and boundary conditions
