-- Add the replacement identifier while older application versions still run.
-- It is nullable only during this migration window; every account is expected
-- to receive its handle from the existing unique username in the next step.
ALTER TABLE accounts
  ADD COLUMN account_handle text;
