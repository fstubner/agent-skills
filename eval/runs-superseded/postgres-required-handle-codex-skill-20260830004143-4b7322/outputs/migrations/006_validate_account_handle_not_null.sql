-- Validate existing rows with a lock mode that permits reads and writes.
ALTER TABLE accounts
  VALIDATE CONSTRAINT accounts_handle_not_null;
