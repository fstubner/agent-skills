CREATE UNIQUE INDEX refunds_payment_owner_key_idx
  ON refunds (payment_id, owner, idempotency_key);

CREATE INDEX refunds_payment_idx ON refunds (payment_id);
