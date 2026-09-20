-- Add the replacement identifier without changing the contract of the old
-- application.  It remains nullable temporarily while existing rows are
-- backfilled and deployed writers begin supplying it.
ALTER TABLE accounts
  ADD COLUMN account_handle text;
