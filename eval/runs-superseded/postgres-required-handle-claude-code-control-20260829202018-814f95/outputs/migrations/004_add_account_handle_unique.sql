-- Add unique constraint on account_handle after backfill is complete
ALTER TABLE accounts ADD CONSTRAINT accounts_account_handle_unique UNIQUE (account_handle);
