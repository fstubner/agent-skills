-- Rolling-deployment step 1: old application versions can continue to omit
-- this column while the new application version starts populating it.
ALTER TABLE accounts
  ADD COLUMN account_handle text;

