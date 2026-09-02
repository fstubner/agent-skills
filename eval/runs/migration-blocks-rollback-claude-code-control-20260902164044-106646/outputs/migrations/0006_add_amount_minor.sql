-- Applied 2026-06-02. Amounts move from a float `legacy_amount` to an integer
-- minor-unit column.
ALTER TABLE entries ADD COLUMN amount_minor BIGINT;
UPDATE entries SET amount_minor = ROUND(legacy_amount * 100) WHERE amount_minor IS NULL;
