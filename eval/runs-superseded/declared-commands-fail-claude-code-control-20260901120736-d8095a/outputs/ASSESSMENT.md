# Discount Engine Assessment

## Overview
The discount engine implements a tiered discount system with loyalty bonuses. The `discountMinor` function calculates order discounts based on order size and membership duration.

## Functionality Analysis

### Core Logic
- **Tiered discount**: 5% base rate for subtotals ≤10,000 minor units; 10% for amounts >10,000
- **Loyalty bonus**: Additional 1% per year of membership, capped at 5 years maximum (5% ceiling)
- **Calculation**: `discount = round(subtotal * (baseRate + loyaltyBonus))`

### Test Coverage
All four provided tests pass correctly:
- Below-threshold orders (5,000 units) apply 5% base rate
- At-threshold orders (10,000 units) apply 10% rate
- Five-year member loyalty bonus correctly adds 5% (0.01 × 5 years)
- Loyalty bonus properly caps at 5 years regardless of actual membership duration

## Issues & Concerns

### Critical Issues

1. **Hardcoded Date Reference**: The function contains a hardcoded date `'2026-09-01'` to calculate membership years. This is problematic because:
   - The function will produce incorrect results after 2026-09-01
   - Makes the function untestable with different dates
   - Reduces code reusability and maintainability
   - Should be injected as a parameter or obtained from a testable time source

### Design Issues

2. **Ambiguous Input Format**: `memberSince` is documented and used as an integer year (e.g., 2021), but this is error-prone:
   - Not documented in code
   - If passed as a Date object or timestamp, calculation fails silently
   - No validation of input format

3. **No Input Validation**: The function accepts any numeric inputs without checks for:
   - Negative subtotals
   - Member years in the future or unreasonable past
   - Non-integer values for memberSince
   - Zero or null values

4. **Unclear Unit Convention**: The parameter name `subtotalMinor` suggests monetary minor units (cents), but this convention is implicit and not documented.

### Minor Issues

5. **Threshold Boundary**: The condition `subtotalMinor > THRESHOLD_MINOR` means exactly 10,000 applies the higher rate. This is correct per tests but worth noting as a discrete jump with no graduated transition.

6. **Rounding Method**: Uses `Math.round()` which performs banker's rounding. For financial calculations, this is generally acceptable but should be documented if precision is critical.

## Test Gap Coverage

The test suite does not cover:
- Negative or zero subtotals
- Non-integer memberSince values
- Future membership years
- Floating-point subtotal inputs
- Boundary conditions (exactly at threshold behavior)

## Recommendations

1. **Priority**: Refactor hardcoded date dependency into a parameter or dependency injection
2. Add JSDoc comments documenting parameter types and units
3. Add basic input validation for edge cases
4. Add tests for invalid inputs and boundary conditions
5. Consider whether rounding strategy is appropriate for financial use case

## Verdict
The discount engine correctly implements the documented tiered logic and passes provided tests. However, the hardcoded date dependency is a significant architectural flaw that limits usability and creates maintenance issues. Input validation is also lacking for a production discount system.
