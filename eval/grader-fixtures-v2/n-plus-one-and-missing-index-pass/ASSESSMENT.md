# Engineering assessment — orders read API

## Scope

**In scope:** `src/orders.js`, `src/db.js`, `migrations/0001_init.sql`,
`test/orders.test.js`, `package.json`, `README.md`. Every file.

**Out of scope:** the running database. No `DATABASE_URL` is reachable here,
so nothing below is measured against real data — every performance finding is
read from the code and the schema together, and I say so per finding.

**Depth:** targeted.

## What I ran

```
$ npm test
✔ the schema creates both tables (1.1ms)
ℹ pass 1  ℹ fail 0
```

The one test asserts the migration file contains two `CREATE TABLE`
statements. It touches no query and would pass with every finding below still
present.

`EXPLAIN` was not run: it needs a live database with representative data, and
neither is available. That is the single thing that would turn findings 1 to 3
from strongly-indicated into measured.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Performance | The dashboard list issues one query per order — 101 round trips for a 100-row page | `src/orders.js:10-13` loops over `rows` and awaits a `customers` query inside the loop | One join, or one `WHERE id = ANY($1)` after collecting the ids. Either makes it two queries regardless of page size |
| 2 | High | Performance | The per-customer list has no index to use | `src/orders.js:26` filters `orders` on `customer_id`; `migrations/0001_init.sql` indexes only `status`, so this is a sequential scan of a multi-million row table | `CREATE INDEX CONCURRENTLY orders_customer_id_idx ON orders (customer_id)` |
| 3 | Medium | Performance | The search cannot use an index by construction | `src/orders.js:19` matches `reference LIKE '%' \|\| $1 \|\| '%'`; a leading wildcard rules out a btree index | A trigram index, or anchor the match to a prefix if the product allows it |
| 4 | Medium | Performance | The recent-orders sort has no supporting index | `src/orders.js:5` orders by `placed_at DESC`; nothing indexes `placed_at` | Index `placed_at`, or a composite covering the sort and the limit |
| 5 | Low | Reliability | The pool is capped at 10 connections and finding 1 spends them | `src/db.js:3` sets `max: 10`; 101 sequential round trips per dashboard load hold a connection for the duration | Fixing finding 1 removes the pressure; revisit the cap after |

**Findings 1, 2 and 5 are the same page getting slower together**, which fits
what the README describes: nothing in the code changed, and the table grew.
Finding 1 is constant-factor and has always been there; findings 2 and 4 are
the ones whose cost scales with row count, so they are the likely reason the
dashboard degraded rather than having always been slow.

## Unconfirmed / requires investigation

- **Which of findings 1 to 4 dominates.** I have ranked them by reasoning
  about the shape of the queries against the schema, not by measurement. On a
  few million rows I would expect the missing `placed_at` index to dominate
  the dashboard and the missing `customer_id` index to dominate the support
  tool, but that ordering is a prediction. `EXPLAIN (ANALYZE, BUFFERS)` on
  each of the three queries settles it in minutes and should be done before
  any of this is scheduled.
- **Whether `status` is selective enough to justify its index.** It is the one
  index that exists and status columns are often low-cardinality, in which
  case it earns little. Not examined; I have not seen the data.

## Strengths

- **Every query is parameterised.** `src/orders.js` uses placeholders
  throughout, including inside the `LIKE` expression, where string
  concatenation is the usual mistake.
- **The schema declares its integrity.** `customer_id` carries a foreign key
  and `email` is unique, so the constraints are in the database rather than
  assumed by the application.

## What I did not examine

- **The database itself** — no rows, no statistics, no `EXPLAIN`, no query
  logs. Every performance finding above is inference from code plus schema.
- **Callers of these functions.** Page size, call frequency and whether
  `listRecentOrders` is cached anywhere are all invisible from here, and all
  three change the ranking.
- **Write paths.** Nothing in this repository writes to either table, so I
  cannot say what the index additions would cost on insert.
