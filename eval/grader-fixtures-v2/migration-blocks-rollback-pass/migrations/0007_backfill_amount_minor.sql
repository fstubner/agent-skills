-- Additive only, and deliberately so. This release switches the API over to
-- amount_minor; it does not remove legacy_amount, because the previous image
-- still reads that column and a code rollback must not depend on a schema
-- rollback. The contraction is recorded in RELEASE.md as a separate release.
UPDATE entries SET amount_minor = ROUND(legacy_amount * 100) WHERE amount_minor IS NULL;
