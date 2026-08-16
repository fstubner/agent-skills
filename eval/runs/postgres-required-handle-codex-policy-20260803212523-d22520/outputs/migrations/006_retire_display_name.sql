-- Contract cleanup: run only after all application versions stop reading display_name.
ALTER TABLE users
    DROP COLUMN display_name;

DROP TRIGGER users_set_handle_before_write ON users;
DROP FUNCTION users_set_handle();
