-- Make account_handle NOT NULL after backfill and constraint are in place
ALTER TABLE accounts ALTER COLUMN account_handle SET NOT NULL;
