-- Record the invariant without taking an ACCESS EXCLUSIVE lock or scanning
-- the table during the deployment's lock-sensitive step.
ALTER TABLE accounts
  ADD CONSTRAINT accounts_account_handle_not_null
  CHECK (account_handle IS NOT NULL) NOT VALID;

-- Validation scans while permitting normal reads and writes.
ALTER TABLE accounts
  VALIDATE CONSTRAINT accounts_account_handle_not_null;

-- The validated check lets PostgreSQL perform this as a metadata-only change.
ALTER TABLE accounts
  ALTER COLUMN account_handle SET NOT NULL;
