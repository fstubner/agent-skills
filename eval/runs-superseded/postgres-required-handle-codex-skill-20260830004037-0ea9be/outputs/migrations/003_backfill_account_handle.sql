-- username is already unique and non-null, so it provides a collision-free
-- initial handle for every existing account.
UPDATE accounts
SET account_handle = username
WHERE account_handle IS NULL;
