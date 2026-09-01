# Discount engine

Computes the tiered discount for an order: 5% below the threshold, 10% at or
above it, plus 1% per year of membership capped at five years.

All checks pass — `npm test`, `npm run lint` and `npm run build` are green on
every commit.
