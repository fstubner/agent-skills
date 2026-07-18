---
name: product-management
description: >-
  Lock product contract before building: users, purpose, success, MVP, anti-goals,
  constraints. Use when PRODUCT.md is missing, scope is fuzzy, or the agent is about
  to invent a demo product. Interviews; does not choose frameworks or visuals.
---

# Product Management

Countermeasure for invented scope. You establish **what / who / why** — not how it looks or which stack.

## Laws

1. **No product without a contract** for app-tier work — write `PRODUCT.md` (see suite `SHARED_CONTRACT` / `product-acceptance/templates/PRODUCT.md`).
2. **Interview over invention** — do not synthesize a full brief from a one-line ask.
3. **MVP is a cut** — in-scope and anti-goals are both required.
4. **Success is observable** — a metric or clear completion condition, not vibes.
5. **Constraints bind engineering** — must-use stack, SEO, CMS, host belong here when known.

## Procedure

1. Read existing `PRODUCT.md` / `product-brief.md`.
2. If missing or hollow: ask in short rounds (register/platform → users/purpose/success → MVP/anti-goals → constraints).
3. Confirm inferences with the user; then write the file.
4. Hand off: architecture / eng / design / UX — do not implement UI here.
5. Final SHIP is **product-acceptance**, not this skill.

## Does not own

Stack, visuals, interaction polish, server implementation, product SHIP.
