CREATE TABLE IF NOT EXISTS refunds (
  id bigserial PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payments(id),
  owner text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner, payment_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS refunds_payment_id_idx ON refunds(payment_id);
