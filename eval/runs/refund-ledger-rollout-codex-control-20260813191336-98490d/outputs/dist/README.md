# Refund ledger

The service records payments and owner-authenticated refunds.

## Rolling deployment

Apply migrations in filename order. `002_create_refunds.sql` is additive and does not rewrite `001_create_payments.sql`, so old application versions can continue running while it is applied. Deploy the new immutable `refund-ledger.tgz` artifact only after tests pass:

```sh
npm run build
```

The literal rollback command is:

```sh
tar -xzf refund-ledger.tgz -C /srv/refund-ledger-previous
```

Rollback is safe because the new migration is additive; old versions ignore the `refunds` table.
