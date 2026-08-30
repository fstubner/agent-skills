-- Application transactions must lock the payment row before checking the balance:
-- SELECT ... FROM payments WHERE id = $1 FOR UPDATE;
-- Then insert the refund and commit atomically. This preserves the invariant
-- when multiple application versions run concurrently.
ALTER TABLE refunds ADD CONSTRAINT refunds_owner_nonempty CHECK (length(owner) > 0);
