# Wallet ledger

Moves money between customer wallet accounts and records every movement in
`ledger_entries`.

The ledger is the source of truth for reconciliation: the sum of entries must
always equal the difference between the account balances. Finance reconciles
nightly.
