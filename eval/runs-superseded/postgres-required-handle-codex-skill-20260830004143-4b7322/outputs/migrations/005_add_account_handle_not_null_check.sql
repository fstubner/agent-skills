-- Record the required-value invariant without scanning or blocking the table.
ALTER TABLE accounts
  ADD CONSTRAINT accounts_handle_not_null
  CHECK (handle IS NOT NULL) NOT VALID;
