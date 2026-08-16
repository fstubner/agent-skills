-- Rolling-deployment step 4: once all deployed writers populate the handle,
-- record the invariant without taking an ACCESS EXCLUSIVE validation lock.
ALTER TABLE accounts
  ADD CONSTRAINT accounts_account_handle_not_null
  CHECK (account_handle IS NOT NULL) NOT VALID;
