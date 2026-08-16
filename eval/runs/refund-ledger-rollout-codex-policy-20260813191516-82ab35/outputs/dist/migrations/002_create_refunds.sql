CREATE TABLE refunds (
  id bigserial PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payments(id),
  account text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, account, idempotency_key)
);

CREATE INDEX refunds_payment_id_idx ON refunds(payment_id);
