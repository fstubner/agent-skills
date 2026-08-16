UPDATE accounts
SET handle = username
WHERE handle IS NULL;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_handle_key UNIQUE (handle);
