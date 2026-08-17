-- Rolling-deployment step 5: validate the backfill while allowing reads and
-- writes to continue. This must succeed before the metadata-only final step.
ALTER TABLE accounts
  VALIDATE CONSTRAINT accounts_account_handle_not_null;
