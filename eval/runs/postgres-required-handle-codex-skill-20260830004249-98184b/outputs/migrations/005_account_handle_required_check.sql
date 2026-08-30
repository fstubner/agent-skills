-- Record the required-field invariant without blocking reads or writes while
-- the existing table is scanned.  The NOT VALID phase also gives the
-- deployment a clear failure if a concurrent writer still leaves a row NULL.
ALTER TABLE accounts
  ADD CONSTRAINT accounts_account_handle_not_null
  CHECK (account_handle IS NOT NULL) NOT VALID;

ALTER TABLE accounts
  VALIDATE CONSTRAINT accounts_account_handle_not_null;
