CREATE TABLE refund_idempotency (
  account text NOT NULL,
  payment_id text NOT NULL REFERENCES payments(id),
  idempotency_key text NOT NULL,
  refund_id text NOT NULL REFERENCES refunds(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account, payment_id, idempotency_key)
);
