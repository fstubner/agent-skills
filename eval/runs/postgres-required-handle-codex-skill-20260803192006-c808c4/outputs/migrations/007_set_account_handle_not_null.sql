-- Rolling-deployment step 6: the validated CHECK lets PostgreSQL perform this
-- as a fast metadata change instead of rescanning the table.
ALTER TABLE accounts
  ALTER COLUMN account_handle SET NOT NULL;

-- display_name remains during the deprecation window so older application
-- versions can continue reading it. Retire it in a later, separately reviewed
-- destructive migration after those versions are no longer deployed.
