-- The validated check makes this metadata-only on PostgreSQL 12+, avoiding a
-- second full table scan and the long ACCESS EXCLUSIVE lock of a bare SET NOT
-- NULL.  Older application versions may continue reading display_name during
-- the rollout; its removal belongs to a later, separately scheduled
-- destructive migration after the deprecation window.
ALTER TABLE accounts
  ALTER COLUMN account_handle SET NOT NULL;
