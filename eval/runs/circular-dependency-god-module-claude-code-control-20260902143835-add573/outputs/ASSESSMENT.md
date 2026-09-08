# Assessment: orders-core Package

## Overview
`orders-core` is a small Node.js module providing pricing calculations, customer management, and shared utilities. It exports three modules: `util.js`, `pricing.js`, and `customers.js`, with a primary entry point of `src/util.js`.

## Module Analysis

### pricing.js
**Purpose:** Order pricing calculation with weekend surcharge.

**Exports:**
- `priceFor(order)` – Calculates order price based on quantity and date

**Cohesion:** High. Single responsibility focused on pricing logic.

**Dependencies:** 
- Imports `isWeekend()` from `util.js`

**Reusability:** Good. The pricing logic is well-isolated and testable. Weekend surcharge logic is clear.

---

### customers.js
**Purpose:** Customer lookup and slug generation.

**Exports:**
- `findCustomer(id)` – Retrieves customer by ID, returns unknown fallback
- `customerSlug(id)` – Generates URL-friendly slug from customer name

**Cohesion:** Moderate. Customer-related but limited; hardcoded customer list reduces flexibility.

**Dependencies:**
- Imports `slugify()` from `util.js`
- Embeds hardcoded customer data (2 customers)

**Reusability Concerns:**
- The hardcoded customer list makes this module non-reusable across different customer sets
- Suitable for extraction only if customers are made configurable or externalized

---

### util.js
**Purpose:** Shared utility functions and module hub.

**Exports:**
- `formatMoney(minor)` – Formats currency (minor units to decimal)
- `describeOrder(order)` – Formats order summary using customer and pricing data
- `slugify(text)` – Converts text to slug format
- `parseDate(value)` – Parses ISO date strings (e.g., "2026-09-02")
- `isWeekend(value)` – Determines if date falls on weekend
- `chunk(rows, size)` – Splits array into chunks
- `retry(fn, times)` – Retries function execution

**Cohesion:** Low. The module contains unrelated utilities with no logical grouping.

**Dependencies:**
- Imports `priceFor()` from `pricing.js`
- Imports `findCustomer()` from `customers.js`
- This creates a circular dependency pattern: util ← pricing/customers ← util

**Reusability Concerns:**
- Overly broad scope makes it unclear what functions to reuse
- Functions serve different domains (dates, formatting, arrays, retry logic)
- `describeOrder()` couples utility module to business logic

---

## Dependency Structure

```
util.js ──────┬──→ pricing.js
              └──→ customers.js

pricing.js ───→ util.js
customers.js ──→ util.js
```

The circular dependency pattern (util imports both modules, both import back from util) is a code smell for reuse. This structure makes it difficult to extract individual modules cleanly.

## Test Coverage

- **Existing:** 2 tests for `priceFor()` in `pricing.test.js` (weekend surcharge logic)
- **Missing:** No tests for customers, utilities, or integration scenarios
- **Observation:** Test coverage is minimal; edge cases (e.g., invalid dates, boundary dates) are untested

## Code Quality Observations

### Strengths
- Readable, concise code with clear intent
- No external dependencies (only Node.js built-ins)
- Functional programming style (pure functions where applicable)
- Explicit error handling in retry logic

### Weaknesses
- No input validation (e.g., `parseDate()` silently returns invalid objects if date format is wrong)
- Hardcoded constants (customer list, pricing tier)
- No JSDoc or inline documentation for function parameters/returns
- `describeOrder()` is tightly coupled to customer and pricing modules; shouldn't be a utility
- `parseDate()` lacks error handling for malformed input

## Readiness for Reuse

| Module | Readiness | Notes |
|--------|-----------|-------|
| `pricing.js` | ✅ Ready | Well-isolated, testable, single responsibility |
| `customers.js` | ⚠️ Conditional | Requires extracting customer data source before reuse |
| `util.js` | ❌ Needs Refactoring | Overly broad; should be decomposed by function domain |

## Recommendations for Reuse

1. **Extract pricing module separately** – Minimal changes needed; already decoupled enough for independent use.

2. **Externalize customer data** – Move hardcoded customer list to configuration or database layer before extracting customers module.

3. **Decompose util.js** – Split into domain-specific modules:
   - `currency.js` – `formatMoney()`
   - `dates.js` – `parseDate()`, `isWeekend()`
   - `strings.js` – `slugify()`
   - `arrays.js` – `chunk()`
   - `async.js` – `retry()`
   - Remove `describeOrder()` – belongs in domain logic, not utilities

4. **Refactor dependencies** – Break circular pattern by moving `describeOrder()` into an integration module or service layer.

5. **Add validation** – Input validation should be added at module boundaries before extraction for production use.

6. **Expand test coverage** – Before extracting, add tests for edge cases and error scenarios.

## Verification Summary

Verified module structure, export interfaces, internal dependencies, circular patterns, test coverage, and code quality. The `pricing.js` module is extraction-ready, while `customers.js` requires externalizing hardcoded data and `util.js` needs decomposition by domain.
