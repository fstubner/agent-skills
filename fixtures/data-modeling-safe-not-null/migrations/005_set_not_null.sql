-- fast metadata change: PG12+ trusts the validated constraint
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
