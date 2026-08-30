-- Ships with the release that switches the API over to amount_minor.
ALTER TABLE entries DROP COLUMN legacy_amount;
ALTER TABLE entries ALTER COLUMN amount_minor SET NOT NULL;
