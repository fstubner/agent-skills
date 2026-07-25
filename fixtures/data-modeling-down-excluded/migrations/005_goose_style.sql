-- +goose Up
ALTER TABLE users ADD COLUMN score INTEGER;

-- +goose Down
ALTER TABLE users DROP COLUMN score;
