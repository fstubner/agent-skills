---
name: data-modeling
description: >-
  Design schemas that enforce the domain's real invariants — choosing keys,
  when to normalize vs. denormalize, nullable columns as the exception not
  the default, referential integrity, and additive/backward-compatible
  migrations. Triggers when designing a new schema or table, when adding a
  field to an existing one, or when a nullable column or a migration is
  about to touch data already in production. Narrower than
  `backend-engineering` (trusted-side runtime laws — secrets, validation,
  auth) — this is specifically about the shape of persisted data, not the
  code that reads and writes it.
---

# Data modeling

A schema is a set of claims about what's always true. Every nullable column,
every unconstrained foreign key, every field with no validation is a claim
the schema explicitly declines to make — sometimes correctly, but that
should be a decision, not a default.

No shared artifacts. Schema quality depends on the domain's actual
invariants, which no generic script can know — this stays a judgment
skill regardless of whether the data is modeled as SQL tables, an ORM's
own schema DSL (Prisma, Django models, SQLAlchemy), or a NoSQL document
store; the rules below apply to all of those the same way. One narrow
slice IS genuinely checkable without knowing the domain, though: whether a
raw SQL migration file does something known to be unsafe regardless of
what it's migrating. `scripts/check-migrations.js` checks exactly that and
nothing more — every check id it emits is prefixed `DM-sql-` on purpose,
so a report can never be misread as having evaluated data modeling
generally. A project with no `.sql` files (ORM-DSL or NoSQL projects
included) gets a clean scope-skip, not a false pass on rules it never
looked at. Run it: `node <this-skill>/scripts/check-migrations.js --root
<dir>`. It checks for destructive drops, an unsafe `NOT NULL` addition, a
rename, and a volatile-function column default — sourced from real
migration linters (Squawk, strong_migrations), not invented — and
excludes down/rollback migrations (which are expected to contain drops by
design) by filename convention or an inline `-- +goose Down` /
`-- migrate:down` marker.

## Rules

1. **Model the invariant, not just the field.** A `discount_percent` column
   that accepts `150` is missing a constraint the domain actually has. This
   is `code-smells`' primitive-obsession problem at the schema level: a raw
   number where a bounded, named concept belongs. Push what you can into a
   `CHECK` constraint, an enum, or a `NOT NULL` rather than trusting every
   caller to enforce it in application code.
2. **A nullable column needs a reason, not just a "maybe."** If a value is
   "usually required, occasionally not," that's often a sign the "not"
   cases are a genuinely different kind of row — model them as a separate,
   optional relationship instead of making every reader check for null.
   Reserve null for values that are truly optional for every row, not as a
   default hedge against being wrong about what's required.
3. **Normalize until it hurts, then denormalize on purpose.** Start
   normalized — one fact stored in one place — so an update can't leave two
   copies disagreeing. Denormalize only for a specific, measured need (a
   read pattern that's actually slow), and record why, so a future reader
   doesn't "fix" the duplication back into an update anomaly.
4. **Enforce referential integrity at the database when you can.**
   Application-level checks get bypassed by the next script, migration, or
   direct database access that doesn't go through that code path. A real
   foreign key constraint can't be forgotten by a future caller the way an
   application check can.
5. **Choose keys for what actually stays stable.** A natural key (email,
   username) that a user can legitimately change makes a bad primary key —
   every reference to it breaks or needs cascading updates. A surrogate key
   (generated ID) stays stable at the cost of being meaningless on its own;
   default to a surrogate key and keep the natural value as a unique,
   changeable column instead of the identity itself.
6. **Migrations touching live data go additive-first.** Prefer add-column
   (nullable) → backfill → make-required → remove-old over a single
   destructive rewrite, especially once real rows exist. A one-shot
   migration that assumes a maintenance window or perfect backfill logic is
   the migration most likely to be the one that actually loses data.
7. **Relational vs. document/schema-less is a query-pattern decision, not a
   fashion one.** Choose relational when data has real cross-entity
   invariants that benefit from joins and constraints; choose
   document/schema-less when the shape genuinely varies per record and
   forcing a fixed schema would just move the flexibility into a JSON blob
   column anyway. Picking one because it's currently popular, without
   checking which the actual access pattern needs, is the failure mode this
   rule exists to catch.
8. **This feeds `backend-engineering`, it doesn't replace it.** Schema
   constraints stop bad data from being stored; `backend-engineering`'s
   trusted-side validation stops bad data from being acted on before it
   gets that far. A system needs both — a schema constraint that only
   catches a violation after the application already trusted the value is
   a real gap, not a redundant check.
