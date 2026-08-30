-- Build uniqueness without blocking normal reads and writes for the table.
CREATE UNIQUE INDEX CONCURRENTLY accounts_handle_uidx
  ON accounts (handle);
