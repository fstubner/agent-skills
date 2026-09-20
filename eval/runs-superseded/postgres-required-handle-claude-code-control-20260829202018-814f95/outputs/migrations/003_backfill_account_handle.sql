-- Backfill account_handle from username for all existing rows
UPDATE accounts SET account_handle = username WHERE account_handle IS NULL;
