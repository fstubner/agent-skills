# Refund ledger

The service records payments and supports authenticated, idempotent refunds.

## Rolling deployment

Apply migrations in filename order. `001_create_payments.sql` is immutable; `002` and
later migrations are additive and can be applied while old application versions run.
The refund uniqueness constraint makes a retry return the original refund, and the
application must enforce the same constraint inside the payment/refund transaction in
the PostgreSQL adapter.

Build one immutable image only after tests pass:

```sh
TAG=2026-08-13.1 npm run build
docker push refund-ledger:2026-08-13.1
```

Deploy by digest in production. A literal rollback to the previous artifact is:

```sh
docker service update --image registry.example.com/refund-ledger:2026-08-12.3 payments
```

The refund endpoint is `POST /payments/:id/refunds` with `Authorization: Bearer <account>`,
`Idempotency-Key`, and JSON `{ "amountCents":  integer }`.
