-- Additive and rolling-deploy safe: old application versions ignore these columns/table.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0);
CREATE TABLE IF NOT EXISTS refunds (
  id bigserial PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payments(id),
  owner text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, idempotency_key)
);
