CREATE TABLE refunds (
  id text PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payments(id),
  owner text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  idempotency_key text NOT NULL,
  UNIQUE (owner, idempotency_key)
);
