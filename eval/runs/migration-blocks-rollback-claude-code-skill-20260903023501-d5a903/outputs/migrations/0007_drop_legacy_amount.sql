-- Deferred to a subsequent release. Dropping legacy_amount in this release
-- would break rollout undo: old code read legacy_amount, so if we undo to
-- the previous image after dropping the column, queries would fail. Keeping
-- the column allows old code and new code to run against the same schema.
-- ALTER TABLE entries DROP COLUMN legacy_amount;
ALTER TABLE entries ALTER COLUMN amount_minor SET NOT NULL;
