-- Enforce uniqueness without blocking reads and writes for the duration of a
-- table-wide index build. This migration must run outside a transaction.
CREATE UNIQUE INDEX CONCURRENTLY accounts_account_handle_unique_idx
  ON accounts (account_handle);
