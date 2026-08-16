# Refund ledger

The service records payments and supports authenticated, idempotent refunds.

Deploy migrations in filename order. `002_create_refunds.sql` is additive and can be
applied while old application versions are serving traffic; `003_refund_ledger_indexes.sql`
is an independently deployable index improvement.

Build only after tests: `npm test && npm run build`. The resulting
`dist/refund-ledger.tar.gz` and checksum are immutable release inputs. To roll back a
release, run this literal command from the release host:

```sh
tar -xzf /srv/releases/refund-ledger-previous.tar.gz -C /srv/refund-ledger --keep-old-files
```
