-- Additive migration: safe to apply while versions that only know about payments run.
CREATE TABLE refunds (
  id text PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payments(id),
  account text NOT NULL,
  idempotency_key text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account, payment_id, idempotency_key)
);

CREATE INDEX refunds_payment_id_idx ON refunds(payment_id);
