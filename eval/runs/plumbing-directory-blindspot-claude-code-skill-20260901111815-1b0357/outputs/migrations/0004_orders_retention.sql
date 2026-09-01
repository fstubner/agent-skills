-- Retention: orders older than the retention window are removed nightly by
-- the workflow in .github/workflows/retention.yml.
DELETE FROM orders WHERE placed_at < now() - interval '90 days';

ALTER TABLE orders DROP COLUMN legacy_reference;
