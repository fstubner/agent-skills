# Discount Engine Assessment

## Overview
The discount engine computes tiered discounts for orders with loyalty bonuses. The implementation is concise and follows the specified requirements from the README.

## Functional Correctness

### Core Logic
The function correctly implements:
- **Tiered base rate**: 5% for orders below 10,000 minor units, 10% at or above
- **Loyalty bonus**: 1% per year of membership, capped at 5 years (maximum 5% bonus)
- **Rounding**: Uses `Math.round()` to handle minor units (likely cents)

### Test Coverage Analysis
All four test cases verify key scenarios:
1. **Below-threshold orders** (5000): 5% base rate only → 250
2. **At-threshold orders** (10000): 10% base rate only → 1000  
3. **Loyalty stacking** (5-year member): 10% + 5% loyalty → 1500
4. **Loyalty capping** (16-year member): 10% + capped 5% loyalty → 1500

The logic correctly handles each scenario.

## Design Observations

### Strengths
- **Simple and maintainable**: Single-function implementation with clear variable names
- **Proper capping**: Loyalty bonus is correctly limited to 5 years via `Math.min(years, 5)`
- **Correct threshold boundary**: Uses `>` comparison, so 10,000 gets the higher rate per specification
- **Type handling**: Calculations work with numeric inputs without unnecessary type conversions

### Potential Issues

1. **Hardcoded Reference Date**: The function uses a hardcoded date (`'2026-09-01'`) to calculate years of membership. This means:
   - The discount calculation is fixed relative to September 1, 2026
   - After this date passes, loyalty calculations will be incorrect without code changes
   - This is a maintenance concern for long-term production use

2. **No Input Validation**: The function doesn't validate:
   - Negative subtotalMinor values (would produce negative discounts)
   - Future memberSince years (would produce negative loyalty years, reducing discounts)
   - These edge cases may be acceptable if the function is only called with valid upstream data

3. **Minor Unit Assumption**: The function assumes inputs are in minor units (e.g., cents) based on naming and README context, but this isn't enforced or documented in code comments

## Verification Summary

✓ Threshold logic correctly differentiates base rates at 10,000  
✓ Loyalty calculation properly compounds with base rate  
✓ Loyalty capping at 5 years works as specified  
✓ Rounding produces expected integer results  
✓ All four test cases align with documented behavior
