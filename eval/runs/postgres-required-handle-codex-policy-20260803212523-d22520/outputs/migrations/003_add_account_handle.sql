-- Expand phase: introduce the handle while old application versions still run.
ALTER TABLE users
    ADD COLUMN handle text;

CREATE OR REPLACE FUNCTION users_set_handle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    base_handle text;
BEGIN
    IF NEW.handle IS NULL THEN
        base_handle := lower(regexp_replace(coalesce(trim(NEW.username), ''), '[^a-zA-Z0-9_]+', '_', 'g'));
        IF base_handle = '' THEN
            base_handle := 'user';
        END IF;
        NEW.handle := base_handle || '_' || NEW.id::text;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_handle_before_write
BEFORE INSERT OR UPDATE OF username ON users
FOR EACH ROW
EXECUTE FUNCTION users_set_handle();
