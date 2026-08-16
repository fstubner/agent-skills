-- Rolling-deployment step 2: username is already unique, so copying it gives
-- every existing row a deterministic unique handle without a lossy transform.
-- The NULL predicate keeps this migration safe to rerun and avoids replacing
-- handles written by a concurrently deployed application version.
UPDATE accounts
SET account_handle = username
WHERE account_handle IS NULL;
