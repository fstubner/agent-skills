-- Add account_handle column as nullable to support both old and new versions
ALTER TABLE accounts ADD COLUMN account_handle text;
