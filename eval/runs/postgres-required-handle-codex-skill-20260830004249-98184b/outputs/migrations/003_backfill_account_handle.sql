-- username is already unique, so copying it gives every existing account a
-- deterministic, collision-free handle.  The NULL predicate keeps this
-- migration safe to rerun and preserves any handle written by a newer app.
UPDATE accounts
SET account_handle = username
WHERE account_handle IS NULL;
