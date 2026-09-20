-- The validated check lets PostgreSQL perform this metadata-only change quickly.
ALTER TABLE accounts
  ALTER COLUMN handle SET NOT NULL;

-- display_name remains during the rolling-deployment compatibility window.
-- Retire it in a separate post-deployment migration after all old versions are gone.
