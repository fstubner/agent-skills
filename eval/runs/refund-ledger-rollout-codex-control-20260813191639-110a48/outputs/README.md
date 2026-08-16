# Refund ledger

Refunds are available at `POST /payments/:id/refunds`. Authenticate with `Authorization: Bearer <payment owner>`, send `Idempotency-Key`, and a JSON body such as `{"amountCents": 1250}`. Unknown payments and payments owned by another account both return the same 404 response.

Deploy migration `002_create_refunds.sql` before rolling out the new application; it is additive and older versions continue to work. Build and test the release with `npm test && docker build --pull -t refund-ledger:$(git rev-parse HEAD) .`. The immutable rollback command is:

```sh
docker service update --image registry.example.com/refund-ledger@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef refund-ledger
```
