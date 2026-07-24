-- This comment mentions DROP TABLE and RENAME COLUMN but is not real SQL.
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN nickname TEXT;

/* another fake mention of DROP COLUMN inside a block comment */
COMMENT ON TABLE users IS 'it''s the users table, with a DROP TABLE mention inside a string literal';
