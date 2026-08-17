-- Additive, rolling-safe schema support. This migration does not alter 001.
CREATE INDEX IF NOT EXISTS refunds_payment_owner_idx ON refunds(payment_id, owner);
