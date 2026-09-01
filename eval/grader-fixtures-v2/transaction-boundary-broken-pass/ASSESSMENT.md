# Engineering assessment — wallet ledger

## Scope

**In scope:** `src/ledger.js`, `src/db.js`, `test/ledger.test.js`,
`package.json`, `README.md` — the whole repository.

**Out of scope:** the database and any reconciliation tooling. Neither is
here, and the README's invariant is enforced by neither as far as this
repository can show.

**Depth:** targeted.

## What I ran

```
$ npm test
✔ transfer refuses when the balance is short (1.0ms)
ℹ pass 1  ℹ fail 0
```

The one test reads `src/ledger.js` as a **string** and asserts it contains
`'insufficient funds'`. It executes no code, connects to no database and would
pass if `transfer` were deleted and replaced by a comment containing that
phrase. It is not coverage of anything.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Data integrity | A transfer is three separate statements with no transaction; a failure between them destroys or duplicates money | `src/ledger.js:12-17` — debit, credit and ledger insert are three awaited `query` calls on a pool, each auto-committing. A crash after line 12 leaves the money debited and never credited | Wrap all three in one transaction on a single checked-out client: `BEGIN`, the three statements, `COMMIT`, with `ROLLBACK` on error |
| 2 | Critical | Data integrity | The README's reconciliation invariant cannot hold, by construction | `README.md` states the sum of `ledger_entries` always equals the difference in balances; finding 1 makes partial application possible, and finding 3 makes over-withdrawal possible | Fixing findings 1 and 3 is what makes the invariant true; until then, nightly reconciliation is the only thing that would notice, after the fact |
| 3 | High | Correctness | The balance check is a read followed by a separate write, so two concurrent transfers can both pass it | `src/ledger.js:9` reads the balance and `src/ledger.js:12` decrements it in a later statement; nothing locks the row between | Make the debit conditional and atomic — `UPDATE ... SET balance_minor = balance_minor - $1 WHERE id = $2 AND balance_minor >= $1` — and treat a zero row count as insufficient funds |
| 4 | Medium | Maintainability | The only test asserts on source text rather than behaviour | `test/ledger.test.js:7` reads the file and checks for a string literal | Replace with a test that exercises `transfer` against a real or fake database; as written it is a false green |

**Findings 1 and 3 compound.** Fixing the transaction alone still allows two
concurrent transfers to pass the balance check and both commit, so the account
goes negative atomically. Fixing the conditional update alone still allows a
crash to debit without crediting. Both are needed and the conditional update
belongs inside the transaction.

## Unconfirmed / requires investigation

- **Whether the schema constrains the balance.** A `CHECK (balance_minor >=
  0)` would make finding 3 fail loudly instead of silently, and there are no
  migrations in this repository to tell me. If one exists, finding 3's
  severity drops from High to Medium; if not, it stands.
- **Whether anything reconciles automatically.** The README says finance
  reconciles nightly, which implies a human process. Whether a job would catch
  a partial transfer, and how quickly, is not visible here.

## Strengths

- **Every statement is parameterised**, including the amounts, so there is no
  injection surface in the money path.
- **The insufficient-funds path returns a reason rather than throwing an
  opaque error**, which is the right shape for a caller that has to tell a
  customer something.

## What I did not examine

- **The database schema.** No migrations are in this repository, so
  constraints, indexes and isolation level are all unknown, and finding 3's
  severity depends on the first of those.
- **Concurrency in practice.** Findings 1 and 3 are read from the code. I did
  not run two concurrent transfers against a real database to observe either.
- **Callers of `transfer`.** Whether it is retried on failure changes finding
  1 from lost money to duplicated money, and nothing here says.
