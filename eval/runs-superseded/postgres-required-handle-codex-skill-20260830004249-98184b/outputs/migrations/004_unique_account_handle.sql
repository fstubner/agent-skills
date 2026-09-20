-- Build the uniqueness check without holding an exclusive table lock for the
-- full scan.  This must run outside a transaction in PostgreSQL.
CREATE UNIQUE INDEX CONCURRENTLY accounts_account_handle_key
  ON accounts (account_handle)
  WHERE account_handle IS NOT NULL;
