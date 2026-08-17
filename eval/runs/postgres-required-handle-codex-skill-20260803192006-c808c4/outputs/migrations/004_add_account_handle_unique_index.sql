-- Rolling-deployment step 3. Run this migration outside a transaction:
-- CONCURRENTLY keeps reads and writes available while the index is built.
CREATE UNIQUE INDEX CONCURRENTLY accounts_account_handle_uidx
  ON accounts (account_handle);
