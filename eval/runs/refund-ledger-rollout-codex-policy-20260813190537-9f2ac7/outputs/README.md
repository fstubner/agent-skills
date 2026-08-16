# Refund ledger

The service records payments and exposes `POST /payments/:id/refunds`. The server preserves
`createServer(options)`; `options.payments` may be one `{ id, owner, amountCents }` object or an
array of them.

Requests require `Authorization: Bearer <account>`, `Idempotency-Key`, and a JSON body containing
a positive integer `amountCents`. Missing and non-owned payments both return `404`, so an account
cannot distinguish those cases. Repeating an idempotency key returns the original refund; changing
the amount for that key returns `409`.

## Rolling PostgreSQL deployment

Apply `migrations/002_create_refunds.sql` before deploying a version that writes refunds. It is
additive and leaves `001_create_payments.sql` unchanged, so old application versions can run while
the new schema is present. The unique `(account, payment_id, idempotency_key)` constraint is the
database boundary for exactly-once retries; production request handling should insert within a
transaction that locks the payment row (`SELECT ... FOR UPDATE`) before checking its remaining
amount.

Build and test one immutable release artifact with:

```sh
./scripts/release.sh
```

The documented literal rollback command is:

```sh
kubectl rollout undo deployment/refund-ledger --to-revision=PREVIOUS_REVISION
```

Replace `PREVIOUS_REVISION` with the literal deployment revision recorded by the release system.
