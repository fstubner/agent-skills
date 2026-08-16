-- Contract phase: new and upgraded versions may now rely on the invariant.
ALTER TABLE users
    ALTER COLUMN handle SET NOT NULL;

CREATE UNIQUE INDEX users_handle_key
    ON users (handle);
