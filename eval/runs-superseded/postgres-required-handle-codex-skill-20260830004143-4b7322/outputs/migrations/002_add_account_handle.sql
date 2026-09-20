-- Expand phase: old application versions ignore this nullable column safely.
ALTER TABLE accounts
  ADD COLUMN handle text;

-- Keep old application versions compatible: writes that do not know about
-- handle still receive the value derived from username.
CREATE FUNCTION accounts_set_handle_from_username()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.handle IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.username IS DISTINCT FROM OLD.username
         AND OLD.handle = OLD.username) THEN
    NEW.handle := NEW.username;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER accounts_set_handle_from_username
BEFORE INSERT OR UPDATE OF username, handle ON accounts
FOR EACH ROW
EXECUTE FUNCTION accounts_set_handle_from_username();
