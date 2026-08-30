-- Backfill from username, whose existing UNIQUE constraint makes this mapping unique.
UPDATE accounts
SET handle = username
WHERE handle IS NULL;
